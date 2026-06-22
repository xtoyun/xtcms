import type { APIRoute } from 'astro';
import fs from 'node:fs';
import path from 'node:path';
import { verifyToken } from '../auth';
import {
  getRegistry,
  saveRegistry,
  resolveTemplateChain,
  invalidateTemplateCache,
  getTemplateMeta,
  type TemplateRegistry,
  type RegistryEntry,
} from '../../../../core/template-registry';

/**
 * GET /api/cms/templates
 * List installed templates with their metadata.
 */
export const GET: APIRoute = async ({ request }) => {
  const user = verifyToken(request);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const reg = getRegistry();
  const active = resolveTemplateChain()[resolveTemplateChain().length - 1];

  const templates = Object.entries(reg.installed).map(([name, entry]) => {
    let meta: any = {};
    try {
      meta = getTemplateMeta(name);
    } catch { /* template might be broken */ }
    return {
      name,
      label: entry.label || meta.label || name,
      version: entry.version,
      type: meta.type || 'custom',
      description: meta.description || '',
      author: meta.author || '',
      source: entry.source,
      extends: entry.extends,
      installedAt: entry.installedAt,
      isActive: name === active,
      supports: meta.supports || [],
      features: meta.features || [],
      thumbnail: entry.path ? path.posix.join(entry.path, 'assets', 'thumbnail.png') : null,
      screenshot: entry.path ? path.posix.join(entry.path, 'assets', 'screenshot.png') : null,
    };
  });

  // Sort: active first, then builtin, then alphabetical
  templates.sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    if (a.source === 'builtin' && b.source !== 'builtin') return -1;
    if (a.source !== 'builtin' && b.source === 'builtin') return 1;
    return a.name.localeCompare(b.name);
  });

  return new Response(JSON.stringify({ templates, active }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

/**
 * POST /api/cms/templates
 * Install or activate a template.
 *
 * Body: { action: 'install' | 'activate' | 'uninstall', template: string, source?: string }
 */
export const POST: APIRoute = async ({ request }) => {
  const user = verifyToken(request);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json().catch(() => ({}));
  const { action, template: tplName, rebuild } = body;

  if (!action || !tplName) {
    return new Response(JSON.stringify({ error: 'Missing action or template' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const cwd = process.cwd();

  switch (action) {
    case 'activate': {
      // Validate the template exists
      const reg = getRegistry();
      if (!reg.installed[tplName] && tplName !== 'blog') {
        return new Response(JSON.stringify({ error: `Template not found: ${tplName}` }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Validate the chain
      try {
        const chain = resolveTemplateChain(tplName);
        invalidateTemplateCache();
        const markerPath = path.join(cwd, '.xtcms', 'active-template.json');
        fs.mkdirSync(path.dirname(markerPath), { recursive: true });
        fs.writeFileSync(markerPath, JSON.stringify({
          name: tplName,
          chain,
          activatedAt: new Date().toISOString(),
        }, null, 2));

        // Signal Vite dev server to reload (Vite ignores .dotdirs)
        const signalPath = path.join(cwd, 'src', '_template_changed');
        fs.writeFileSync(signalPath, Date.now().toString());

        // Update registry
        reg.active = tplName;
        saveRegistry(reg);

        // Trigger rebuild if requested (production mode)
        if (rebuild) {
          const { exec } = await import('node:child_process');
          exec('npm run build', { cwd, timeout: 120000 }, (err, stdout, stderr) => {
            if (err) {
              console.error('[xtcms] Rebuild failed:', stderr);
            } else {
              console.log('[xtcms] Rebuild complete. Restart process to apply.');
              // Write a restart signal for PM2/systemd
              fs.writeFileSync(path.join(cwd, '.xtcms', 'needs-restart'), Date.now().toString());
            }
          });
        }

        return new Response(JSON.stringify({
          success: true,
          template: tplName,
          chain,
          rebuilding: !!rebuild,
          message: rebuild
            ? `Template activated: ${tplName}. Rebuilding…`
            : `Template activated: ${tplName}. Rebuild required for frontend changes.`,
        }), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    case 'install': {
      const source = body.source || `npm:@xtcms/template-${tplName}`;
      // For now, only support templates that are already in the templates/ directory
      // Full npm/git install will come in Phase 3
      const tplPath = path.join(cwd, 'templates', `@xtcms-template-${tplName}`);
      if (!fs.existsSync(tplPath)) {
        return new Response(JSON.stringify({
          error: `Template not found locally. Install via: npm install @xtcms/template-${tplName}`,
          hint: 'Place the template in the templates/ directory or install via npm.',
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Read template.yml to get metadata
      let meta: any = {};
      try {
        const metaPath = path.join(tplPath, 'template.yml');
        if (fs.existsSync(metaPath)) {
          const { parseYAML } = await import('../../../../core/content');
          meta = parseYAML(fs.readFileSync(metaPath, 'utf8'));
        }
      } catch { /* metadata optional */ }

      const reg = getRegistry();
      reg.installed[tplName] = {
        name: tplName,
        label: meta.label || tplName,
        version: meta.version || '0.0.0',
        source: 'npm',
        extends: meta.extends || 'blog',
        installedAt: new Date().toISOString(),
        path: `templates/@xtcms-template-${tplName}`,
      };
      saveRegistry(reg);
      invalidateTemplateCache();

      return new Response(JSON.stringify({
        success: true,
        template: reg.installed[tplName],
        message: `Template installed: ${tplName}`,
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    case 'uninstall': {
      if (tplName === 'blog') {
        return new Response(JSON.stringify({ error: 'Cannot uninstall the built-in blog template' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const reg = getRegistry();
      if (reg.active === tplName) {
        return new Response(JSON.stringify({
          error: 'Cannot uninstall the active template. Switch to another template first.',
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const entry = reg.installed[tplName];
      if (!entry) {
        return new Response(JSON.stringify({ error: 'Template not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Remove template directory
      const tplPath = path.join(cwd, entry.path);
      if (fs.existsSync(tplPath)) {
        fs.rmSync(tplPath, { recursive: true, force: true });
      }

      delete reg.installed[tplName];
      saveRegistry(reg);
      invalidateTemplateCache();

      return new Response(JSON.stringify({
        success: true,
        message: `Template uninstalled: ${tplName}`,
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    default:
      return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
  }
};
