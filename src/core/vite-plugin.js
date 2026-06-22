import fs from 'node:fs';
import path from 'node:path';

/**
 * Vite plugin for xtcms template chain resolution.
 *
 * At build/dev start:
 *   1. Reads the active template from .xtcms/active-template.json
 *   2. Resolves the inheritance chain (e.g., ['blog', 'enterprise'])
 *   3. Copies/maps template pages into src/pages/ for Astro routing
 *   4. Sets up Vite aliases for $layouts/ and $template/
 *   5. Generates content.config.ts from merged collections
 *   6. Watches template files for changes in dev mode
 */
export function templateChainPlugin() {
  const CWD = process.cwd();
  const PAGES_DIR = path.join(CWD, 'src', 'pages');
  const PAGES_BAK_DIR = path.join(CWD, '.xtcms', 'pages-bak');

  let resolvedLayoutsDir = '';
  let resolvedComponentsDir = '';

  function getActiveChain() {
    const activePath = path.join(CWD, '.xtcms', 'active-template.json');
    if (fs.existsSync(activePath)) {
      return JSON.parse(fs.readFileSync(activePath, 'utf8')).chain || ['blog'];
    }
    return ['blog'];
  }

  function getTemplateDir(tplName) {
    if (tplName === 'blog') {
      const p = path.join(CWD, 'templates', 'blog');
      return fs.existsSync(p) ? p : null;
    }
    const regPath = path.join(CWD, 'templates', '.registry.json');
    if (fs.existsSync(regPath)) {
      const reg = JSON.parse(fs.readFileSync(regPath, 'utf8'));
      const entry = reg.installed?.[tplName];
      if (entry) {
        const p = path.join(CWD, entry.path);
        return fs.existsSync(p) ? p : null;
      }
    }
    return null;
  }

  /**
   * Walk a directory recursively, returning all file paths relative to the dir.
   */
  function walkDir(dir, relativeTo = dir) {
    const results = [];
    if (!fs.existsSync(dir)) return results;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...walkDir(full, relativeTo));
      } else {
        results.push({
          absPath: full,
          relPath: path.relative(relativeTo, full).replace(/\\/g, '/'),
        });
      }
    }
    return results;
  }

  /**
   * Find a directory in the template chain (child → parent priority).
   */
  function resolveDirInChain(chain, subDir) {
    for (let i = chain.length - 1; i >= 0; i--) {
      const tplDir = getTemplateDir(chain[i]);
      if (tplDir) {
        const full = path.join(tplDir, subDir);
        if (fs.existsSync(full)) return full;
      }
    }
    return null;
  }

  /**
   * Copy directory contents recursively.
   */
  function copyDir(src, dest) {
    if (!fs.existsSync(src)) return;
    fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        copyDir(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  /**
   * Sync template pages into src/pages/.
   * Preserves any pages not coming from templates.
   */
  function syncPageFiles(chain) {
    // On first run, back up any existing non-template pages
    if (!fs.existsSync(PAGES_BAK_DIR)) {
      if (fs.existsSync(PAGES_DIR)) {
        copyDir(PAGES_DIR, PAGES_BAK_DIR);
      }
    }

    // Clear current pages (keep api/ directory)
    if (fs.existsSync(PAGES_DIR)) {
      const entries = fs.readdirSync(PAGES_DIR, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === 'api') continue; // Preserve API routes
        const p = path.join(PAGES_DIR, entry.name);
        fs.rmSync(p, { recursive: true, force: true });
      }
    }

    // Copy pages from template chain (parent first, child overwrites)
    for (const tplName of chain) {
      const tplDir = getTemplateDir(tplName);
      if (tplDir) {
        const tplPages = path.join(tplDir, 'src', 'pages');
        if (fs.existsSync(tplPages)) {
          copyDir(tplPages, PAGES_DIR);
        }
      }
    }

    // Apply user overrides on top
    const overridesPages = path.join(CWD, '.xtcms', 'overrides', 'src', 'pages');
    if (fs.existsSync(overridesPages)) {
      copyDir(overridesPages, PAGES_DIR);
    }
  }

  /**
   * Generate content.config.ts from template chain (inline to avoid import issues).
   */
  function generateContentConfigSync() {
    try {
      const target = path.join(CWD, 'src', 'content.config.ts');
      const content = buildContentConfigContent();
      fs.writeFileSync(target, content);
      console.log('[xtcms] Generated content.config.ts');
    } catch (e) {
      console.error('[xtcms] Failed to generate content.config.ts:', e.message);
    }
  }

  function buildContentConfigContent() {
    // Read collections from template chain
    const chain = getActiveChain();
    const folderCollections = [];
    const seen = new Set();

    for (const tplName of chain) {
      const tplDir = getTemplateDir(tplName);
      if (!tplDir) continue;
      const collPath = path.join(tplDir, 'collections.yml');
      if (!fs.existsSync(collPath)) continue;

      const raw = fs.readFileSync(collPath, 'utf8');
      const collData = parseYamlSimple(raw);
      if (collData.collections && Array.isArray(collData.collections)) {
        for (const col of collData.collections) {
          if (col.folder && !seen.has(col.name)) {
            seen.add(col.name);
            folderCollections.push(col);
          }
        }
      }
    }

    const lines = [
      `import { defineCollection, z } from 'astro:content';`,
      `import { glob } from 'astro/loaders';`,
    ];

    for (const col of folderCollections) {
      const fields = (col.fields || []).filter(f => f.name !== 'body'); // body is Astro special
      const schemaLines = fields.map(f => {
        let zod = 'z.string()';
        // A field is optional if required=false, or if it has a default value
        const req = f.required !== false && f.required !== 'false' && f.default === undefined;
        switch (f.widget) {
          case 'number': zod = 'z.number()'; break;
          case 'boolean': zod = 'z.boolean()'; break;
          case 'datetime':
            // YAML dates like 2026-06-21 are auto-parsed to Date objects by Astro.
            // Use coerce.string() to handle both Date objects and raw strings.
            zod = 'z.coerce.string()';
            break;
          case 'list': zod = 'z.array(z.string())'; break;
        }
        if (!req) zod += '.optional()';
        if (f.default !== undefined && f.widget === 'list') zod += '.default([])';
        else if (f.default !== undefined && f.widget === 'boolean') zod += `.default(${f.default})`;
        return `    ${f.name}: ${zod},`;
      });

      lines.push('', `const ${col.name} = defineCollection({`);
      lines.push(`  loader: glob({ pattern: '**/*.md', base: './${col.folder}' }),`);
      lines.push(`  schema: z.object({`);
      lines.push(schemaLines.join('\n'));
      lines.push(`  }),`);
      lines.push(`});`);
    }

    const names = folderCollections.map(c => c.name);
    lines.push('', `export const collections = { ${names.join(', ')} };`);
    return lines.join('\n');
  }

  function parseYamlSimple(raw) {
    const lines = raw.split('\n');
    const result = { collections: [] };
    let currentCol = null;
    let currentFields = null;
    let inFields = false;
    let inList = false;
    let listKey = '';
    let listVals = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      // Top-level key
      if (trimmed === 'collections:') continue;

      // Collection item
      if (trimmed === '- name:' || line.match(/^\s*- name:\s*(.+)/)) {
        if (currentCol) {
          if (currentFields) currentCol.fields = currentFields;
          result.collections.push(currentCol);
        }
        const m = trimmed.match(/^- name:\s*(.+)/);
        currentCol = { name: (m ? m[1] : '').replace(/["']/g, '') };
        currentFields = null;
        inFields = false;
        continue;
      }

      if (!currentCol) continue;

      // Fields marker
      if (trimmed === 'fields:') {
        inFields = true;
        currentFields = [];
        continue;
      }

      // Settings marker (skip)
      if (trimmed === 'settings:') {
        inFields = false;
        continue;
      }

      if (inFields) {
        // Field item
        const fieldMatch = trimmed.match(/^-\s*\{\s*(.+)\s*\}$/);
        if (fieldMatch) {
          const field = {};
          // Parse inline object
          const inner = fieldMatch[1];
          const kvRe = /(\w+):\s*("[^"]*"|'[^']*'|[^,]+)/g;
          let m;
          while ((m = kvRe.exec(inner)) !== null) {
            let v = m[2].trim().replace(/^["']|["']$/g, '');
            if (v === 'true') v = true;
            else if (v === 'false') v = false;
            else if (/^\d+$/.test(v)) v = Number(v);
            field[m[1]] = v;
          }
          currentFields.push(field);
        }
        // List field with items
        const listMatch = trimmed.match(/^\s*-\s+(.+)$/);
        if (listMatch && !trimmed.startsWith('- {')) {
          if (inList) {
            listVals.push(listMatch[1].trim().replace(/^["']|["']$/g, ''));
          }
        }
        continue;
      }

      // Other collection properties
      if (!inFields) {
        const kv = trimmed.match(/^(\w[\w-]*):\s*(.+)$/);
        if (kv) {
          let v = kv[2].trim().replace(/^["']|["']$/g, '');
          if (v === 'true') v = true;
          else if (v === 'false') v = false;
          currentCol[kv[1]] = v;
        }
      }
    }

    if (currentCol) {
      if (currentFields) currentCol.fields = currentFields;
      result.collections.push(currentCol);
    }

    return result;
  }

  return {
    name: 'xtcms-template-chain',

    async config(config) {
      const chain = getActiveChain();
      console.log(`[xtcms] Template chain: ${chain.join(' → ')}`);

      // Resolve directories for aliases
      resolvedLayoutsDir = resolveDirInChain(chain, 'src/layouts') || '';
      resolvedComponentsDir = resolveDirInChain(chain, 'src/components') || '';

      // Sync template pages
      syncPageFiles(chain);

      // Generate content.config.ts
      generateContentConfigSync();

      // Store for resolveId hook
      return {};
    },

    resolveId(id) {
      // Resolve $layouts/ imports to the template chain layout directory
      if (id.startsWith('$layouts/')) {
        const relPath = id.slice('$layouts/'.length);
        const resolved = path.join(resolvedLayoutsDir, relPath);
        if (fs.existsSync(resolved)) return resolved;
        // Try without extension
        for (const ext of ['.astro', '.svelte', '.js', '.ts']) {
          const withExt = resolved + ext;
          if (fs.existsSync(withExt)) return withExt;
        }
      }
      // Resolve $template/ imports
      if (id.startsWith('$template/')) {
        const relPath = id.slice('$template/'.length);
        const resolved = path.join(resolvedComponentsDir, relPath);
        if (fs.existsSync(resolved)) return resolved;
        for (const ext of ['.astro', '.svelte', '.js', '.ts']) {
          const withExt = resolved + ext;
          if (fs.existsSync(withExt)) return withExt;
        }
      }
      // Resolve $core/ imports
      if (id.startsWith('$core/')) {
        const relPath = id.slice('$core/'.length);
        const coreDir = path.join(CWD, 'src', 'core');
        const resolved = path.join(coreDir, relPath);
        if (fs.existsSync(resolved)) return resolved;
        for (const ext of ['.ts', '.js', '.astro']) {
          const withExt = resolved + ext;
          if (fs.existsSync(withExt)) return withExt;
        }
      }
      return null; // Let Vite handle other resolutions
    },

    configureServer(server) {
      let currentChain = getActiveChain();

      function watchTemplateDirs(chain) {
        const watchDirs = [];
        for (const tplName of chain) {
          const tplDir = getTemplateDir(tplName);
          if (tplDir) watchDirs.push(tplDir);
        }
        const overridesPages = path.join(CWD, '.xtcms', 'overrides');
        if (fs.existsSync(overridesPages)) watchDirs.push(overridesPages);
        for (const dir of watchDirs) {
          server.watcher.add(dir);
        }
      }

      watchTemplateDirs(currentChain);

      // Handle template switch signal (both 'add' and 'change' events)
      function handleTemplateSwitch() {
        console.log('[xtcms] Template switch detected, restarting dev server...');
        setTimeout(async () => {
          const newChain = getActiveChain();
          console.log(`[xtcms] New template chain: ${newChain.join(' → ')}`);
          generateContentConfigSync();
          syncPageFiles(newChain);
          currentChain = newChain;
          watchTemplateDirs(newChain);
          // Full restart to clear Astro/Vite module cache
          await server.restart();
          console.log('[xtcms] Server restarted with new template');
        }, 300);
      }

      function isSwitchSignal(rel) {
        return rel === 'src/_template_changed' || rel.endsWith('_template_changed');
      }

      server.watcher.on('change', (filePath) => {
        const rel = path.relative(CWD, filePath);

        if (isSwitchSignal(rel)) {
          handleTemplateSwitch();
          return;
        }

        if (rel.includes('collections.yml') || rel.includes('template.yml')) {
          console.log('[xtcms] Template config changed, regenerating...');
          generateContentConfigSync();
          syncPageFiles(currentChain);
        }
        if (rel.includes('src/pages/') || rel.includes('src/layouts/') || rel.includes('src/components/')) {
          console.log('[xtcms] Template file changed, syncing pages...');
          syncPageFiles(currentChain);
        }
      });

      // Create signal file at startup so subsequent writes trigger 'change' event
      const signalPath = path.join(CWD, 'src', '_template_changed');
      if (!fs.existsSync(signalPath)) {
        fs.writeFileSync(signalPath, Date.now().toString());
      }

      server.watcher.on('add', async (filePath) => {
        const rel = path.relative(CWD, filePath);
        if (isSwitchSignal(rel)) {
          handleTemplateSwitch();
          return;
        }
        if (rel.includes('src/pages/')) {
          syncPageFiles(currentChain);
        }
      });
    },
  };
}
