import type { APIRoute } from 'astro';
import fs from 'node:fs';
import path from 'node:path';
import { verifyToken } from './auth';
import { resolveTemplateChain, getTemplateCollections } from '../../../core/template-registry';

/**
 * GET /api/cms/files
 *
 * Query params:
 *   list=true                   → flat file list for CMS initialization
 *   list=true&collection=posts  → paginated entries for a specific collection
 *   &page=1 &limit=50           → pagination params
 *   media=path                  → fetch a single binary file
 */
export const GET: APIRoute = async ({ request }) => {
  const user = verifyToken(request);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const isList = url.searchParams.get('list') === 'true';
  const mediaPath = url.searchParams.get('media');
  const collection = url.searchParams.get('collection');
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const limit = parseInt(url.searchParams.get('limit') || '50', 10);
  const cwd = process.cwd();

  // ── Binary file fetch ──
  if (mediaPath) {
    const fullPath = path.join(cwd, mediaPath);
    if (!fs.existsSync(fullPath)) {
      return new Response(null, { status: 404 });
    }
    const buf = fs.readFileSync(fullPath);
    const ext = path.extname(mediaPath).toLowerCase();
    const mime = getMimeType(ext);
    return new Response(buf, { headers: { 'Content-Type': mime } });
  }

  // ── Paginated collection view ──
  if (isList && collection) {
    const result = getCollectionEntries(cwd, collection, page, limit);
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── Flat file listing (CMS init) ──
  if (isList) {
    const files = collectAllFiles(cwd);
    return new Response(JSON.stringify({ files }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ error: 'Missing list=true parameter' }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  });
};

/**
 * Get the folder path for a collection from the template chain.
 */
function getCollectionFolder(collectionName: string): string {
  try {
    const chain = resolveTemplateChain();
    for (const tplName of chain) {
      const colls = getTemplateCollections(tplName);
      if (colls.collections && Array.isArray(colls.collections)) {
        const col = colls.collections.find((c: any) => c.name === collectionName);
        if (col?.folder) return col.folder;
      }
    }
  } catch { /* use fallback */ }

  // Fallback known folders
  const known: Record<string, string> = {
    posts: 'src/content/posts',
    pages: 'src/content/pages',
    projects: 'src/content/projects',
    services: 'src/content/services',
  };
  return known[collectionName] || `src/content/${collectionName}`;
}

/**
 * Get paginated entries for a specific collection.
 */
function getCollectionEntries(cwd: string, collectionName: string, page: number, limit: number) {
  const folder = getCollectionFolder(collectionName);

  const absPath = path.join(cwd, folder);
  const entries: any[] = [];

  if (fs.existsSync(absPath)) {
    const allFiles = fs.readdirSync(absPath)
      .filter(f => /\.(md|yml|yaml)$/i.test(f))
      .sort()
      .reverse(); // newest first

    const total = allFiles.length;
    const totalPages = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    const pageFiles = allFiles.slice(start, start + limit);

    for (const f of pageFiles) {
      const fullPath = path.join(absPath, f);
      const relPath = path.relative(cwd, fullPath).replace(/\\/g, '/');
      const stat = fs.statSync(fullPath);
      entries.push({
        path: relPath,
        sha: stat.mtimeMs.toString(36),
        size: stat.size,
        name: f,
        text: fs.readFileSync(fullPath, 'utf8'),
      });
    }

    return {
      entries,
      pagination: { page, totalPages, total },
    };
  }

  return {
    entries: [],
    pagination: { page: 1, totalPages: 0, total: 0 },
  };
}

/**
 * Collect all content files (initial CMS load).
 */
function collectAllFiles(cwd: string) {
  const files: Array<{ path: string; sha: string; size: number; name: string; text?: string }> = [];

  // Scan ALL subdirectories under src/content/ (not just hardcoded list)
  const contentRoot = path.join(cwd, 'src/content');
  if (fs.existsSync(contentRoot)) {
    const dirs = fs.readdirSync(contentRoot, { withFileTypes: true })
      .filter(d => d.isDirectory() || d.isDirectory());

    // Also include the root-level files in src/content if any
    const scanDir = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true, recursive: true });
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        if (entry.name.startsWith('.')) continue;
        const fullPath = path.join(entry.parentPath || dir, entry.name);
        const relPath = path.relative(cwd, fullPath).replace(/\\/g, '/');
        const stat = fs.statSync(fullPath);

        const file: any = {
          path: relPath,
          sha: stat.mtimeMs.toString(36),
          size: stat.size,
          name: entry.name,
        };

        if (/\.(md|yml|yaml)$/i.test(entry.name)) {
          file.text = fs.readFileSync(fullPath, 'utf8');
        }

        files.push(file);
      }
    };

    scanDir(contentRoot);
  }

  // Also include public/uploads
  const uploadsDir = path.join(cwd, 'public/uploads');
  if (fs.existsSync(uploadsDir)) {
    const entries = fs.readdirSync(uploadsDir, { withFileTypes: true, recursive: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const fullPath = path.join(entry.parentPath || uploadsDir, entry.name);
      const relPath = path.relative(cwd, fullPath).replace(/\\/g, '/');
      const stat = fs.statSync(fullPath);
      files.push({
        path: relPath,
        sha: stat.mtimeMs.toString(36),
        size: stat.size,
        name: entry.name,
      });
    }
  }

  return files;
}

function getMimeType(ext: string): string {
  const m: Record<string, string> = {
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf', '.ico': 'image/x-icon',
    '.mp4': 'video/mp4', '.webm': 'video/webm',
    '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
  };
  return m[ext] || 'application/octet-stream';
}
