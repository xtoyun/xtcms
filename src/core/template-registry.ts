import fs from 'node:fs';
import path from 'node:path';
import { load as parseYAML } from 'js-yaml';

/**
 * Template metadata from template.yml
 */
export interface TemplateMeta {
  name: string;
  version: string;
  type: string;
  label: string;
  description?: string;
  author?: string;
  license?: string;
  extends?: string;
  supports: string[];
  layouts?: Record<string, string>;
  features?: string[];
  customizable?: CustomizableConfig;
  requires?: Record<string, string>;
}

export interface CustomizableField {
  name: string;
  label: string;
  type: 'color' | 'select' | 'number' | 'boolean';
  default: any;
  options?: string[];
  min?: number;
  max?: number;
}

export interface CustomizableGroup {
  [key: string]: CustomizableField[];
}

export type CustomizableConfig = Record<string, CustomizableField[]>;

/**
 * Template registry entry from .registry.json
 */
export interface RegistryEntry {
  name: string;
  label: string;
  version: string;
  source: 'builtin' | 'npm' | 'git';
  extends: string | null;
  installedAt: string;
  path: string;
}

export interface TemplateRegistry {
  installed: Record<string, RegistryEntry>;
  active: string;
}

/**
 * Resolved file in the template chain, with its source template.
 */
export interface ResolvedFile {
  path: string;        // Relative path within template, e.g. "src/pages/index.astro"
  source: string;      // Template name that provided this file
  absPath: string;     // Absolute path on disk
}

// ── Caches ──

let _registry: TemplateRegistry | null = null;
let _activeChain: string[] | null = null;

// ── Registry ──

const REGISTRY_PATH = 'templates/.registry.json';
const ACTIVE_PATH = '.xtcms/active-template.json';

/**
 * Read the template registry from disk.
 */
export function getRegistry(): TemplateRegistry {
  if (_registry) return _registry;
  const p = path.join(process.cwd(), REGISTRY_PATH);
  if (!fs.existsSync(p)) {
    // Initialize with blog as default
    _registry = {
      installed: {
        blog: {
          name: 'blog',
          label: '博客模板',
          version: '1.0.0',
          source: 'builtin',
          extends: null,
          installedAt: new Date().toISOString(),
          path: 'templates/blog',
        },
      },
      active: 'blog',
    };
    return _registry;
  }
  const raw = fs.readFileSync(p, 'utf8');
  _registry = JSON.parse(raw);
  return _registry!;
}

/**
 * Write registry back to disk.
 */
export function saveRegistry(reg: TemplateRegistry): void {
  fs.mkdirSync(path.dirname(path.join(process.cwd(), REGISTRY_PATH)), { recursive: true });
  fs.writeFileSync(path.join(process.cwd(), REGISTRY_PATH), JSON.stringify(reg, null, 2));
  _registry = reg;
}

/**
 * Get the currently active template name.
 */
export function getActiveTemplate(): string {
  const reg = getRegistry();
  // Check the active marker file first (more reliable)
  const p = path.join(process.cwd(), ACTIVE_PATH);
  if (fs.existsSync(p)) {
    const marker = JSON.parse(fs.readFileSync(p, 'utf8'));
    return marker.name || 'blog';
  }
  return reg.active || 'blog';
}

/**
 * Resolve the full template chain from the active template back to root.
 * Returns template names in order from root (lowest priority) to active (highest).
 * Example: activate 'enterprise' that extends 'blog' → ['blog', 'enterprise']
 */
export function resolveTemplateChain(templateName?: string): string[] {
  const name = templateName || getActiveTemplate();
  // Only use cache if no explicit name given AND cache is set
  if (!templateName && _activeChain) return _activeChain;
  const reg = getRegistry();
  const chain: string[] = [];
  const visited = new Set<string>();

  let current: string | null = name;
  while (current) {
    if (visited.has(current)) {
      throw new Error(`Circular template inheritance detected: ${[...visited, current].join(' → ')}`);
    }
    visited.add(current);

    const entry = reg.installed[current];
    if (!entry) {
      throw new Error(`Template not found in registry: ${current}`);
    }
    chain.unshift(current); // prepend so root is first
    current = entry.extends;
  }

  _activeChain = chain;
  return chain;
}

/**
 * Invalidate caches (call after template switch).
 */
export function invalidateTemplateCache(): void {
  _registry = null;
  _activeChain = null;
}

// ── Template file resolution ──

const OVERRIDES_DIR = '.xtcms/overrides';
const CORE_FALLBACK_DIR = 'src/core/fallback'; // minimal fallback layouts

/**
 * Find a file along the template chain, checking from highest priority to lowest:
 *   1. User overrides (.xtcms/overrides/)
 *   2. Active template (last in chain)
 *   3. Parent templates (backwards through chain)
 *   4. Core fallback
 *
 * Returns the first match found.
 */
export function resolveTemplateFile(relativePath: string, chain?: string[]): ResolvedFile | null {
  const templateChain = chain || resolveTemplateChain();
  const cwd = process.cwd();

  // 1. Check user overrides (highest priority)
  const overridePath = path.join(cwd, OVERRIDES_DIR, relativePath);
  if (fs.existsSync(overridePath)) {
    return { path: relativePath, source: 'user-override', absPath: overridePath };
  }

  // 2. Check templates in chain, reverse order (child → parent)
  for (let i = templateChain.length - 1; i >= 0; i--) {
    const tplName = templateChain[i];
    const reg = getRegistry();
    const entry = reg.installed[tplName];
    if (!entry) continue;

    const tplPath = path.join(cwd, entry.path, relativePath);
    if (fs.existsSync(tplPath)) {
      return { path: relativePath, source: tplName, absPath: tplPath };
    }
  }

  // 3. Core fallback
  const fallbackPath = path.join(cwd, CORE_FALLBACK_DIR, relativePath);
  if (fs.existsSync(fallbackPath)) {
    return { path: relativePath, source: 'core-fallback', absPath: fallbackPath };
  }

  return null;
}

/**
 * List all unique template files across the chain for a given subdirectory.
 * Returns the resolved file list (deduplicated by relative path, highest priority wins).
 */
export function listTemplateFiles(subdir: string, chain?: string[]): ResolvedFile[] {
  const templateChain = chain || resolveTemplateChain();
  const cwd = process.cwd();
  const fileMap = new Map<string, ResolvedFile>();

  // Process in priority order (highest last = wins in map)
  // Core fallback first (lowest priority)
  const fallbackDir = path.join(cwd, CORE_FALLBACK_DIR, subdir);
  if (fs.existsSync(fallbackDir)) {
    collectFiles(fallbackDir, subdir, 'core-fallback', fileMap);
  }

  // Templates root → child
  for (const tplName of templateChain) {
    const reg = getRegistry();
    const entry = reg.installed[tplName];
    if (!entry) continue;
    const tplDir = path.join(cwd, entry.path, subdir);
    if (fs.existsSync(tplDir)) {
      collectFiles(tplDir, subdir, tplName, fileMap);
    }
  }

  // User overrides (highest priority)
  const overrideDir = path.join(cwd, OVERRIDES_DIR, subdir);
  if (fs.existsSync(overrideDir)) {
    collectFiles(overrideDir, subdir, 'user-override', fileMap);
  }

  return [...fileMap.values()];
}

function collectFiles(
  dir: string,
  subdir: string,
  source: string,
  map: Map<string, ResolvedFile>,
): void {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.join(subdir, entry.name).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      collectFiles(fullPath, relativePath, source, map);
    } else if (entry.isFile()) {
      map.set(relativePath, { path: relativePath, source, absPath: fullPath });
    }
  }
}

// ── Template metadata ──

let _metaCache: Map<string, TemplateMeta> = new Map();

/**
 * Read template.yml for a given template.
 */
export function getTemplateMeta(templateName: string): TemplateMeta {
  if (_metaCache.has(templateName)) return _metaCache.get(templateName)!;

  const reg = getRegistry();
  const entry = reg.installed[templateName];
  if (!entry) throw new Error(`Template not found: ${templateName}`);

  const metaPath = path.join(process.cwd(), entry.path, 'template.yml');
  if (!fs.existsSync(metaPath)) {
    throw new Error(`template.yml not found for template: ${templateName}`);
  }

  const raw = fs.readFileSync(metaPath, 'utf8');
  const meta = parseYAML(raw) as unknown as TemplateMeta;
  _metaCache.set(templateName, meta);
  return meta;
}

/**
 * Read collections.yml for a given template.
 */
export function getTemplateCollections(templateName: string): Record<string, any> {
  const reg = getRegistry();
  const entry = reg.installed[templateName];
  if (!entry) throw new Error(`Template not found: ${templateName}`);

  const collPath = path.join(process.cwd(), entry.path, 'collections.yml');
  if (!fs.existsSync(collPath)) return { collections: [], settings: [] };

  const raw = fs.readFileSync(collPath, 'utf8');
  return parseYAML(raw);
}

/**
 * Get the merged customizable config for the entire template chain.
 */
export function getMergedCustomizable(chain?: string[]): CustomizableConfig {
  const templateChain = chain || resolveTemplateChain();
  const merged: CustomizableConfig = {};

  for (const tplName of templateChain) {
    const meta = getTemplateMeta(tplName);
    if (!meta.customizable || typeof meta.customizable !== 'object') continue;

    for (const [group, fields] of Object.entries(meta.customizable)) {
      if (!Array.isArray(fields)) continue;
      if (!merged[group]) merged[group] = [];
      // Merge: child fields with same name override parent
      for (const field of fields) {
        if (!field || typeof field !== 'object') continue;
        const existingIdx = merged[group].findIndex(f => f.name === field.name);
        if (existingIdx >= 0) {
          merged[group][existingIdx] = field; // child overrides parent
        } else {
          merged[group].push(field);
        }
      }
    }
  }

  return merged;
}

/**
 * Invalidate metadata cache.
 */
export function invalidateMetaCache(): void {
  _metaCache = new Map();
}
