export const prerender = false;

import type { APIRoute } from 'astro';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { verifyToken } from '../../../lib/auth';
import { processUploadedImage, isImage } from '../../../lib/image-utils';
import { apiError, apiSuccess } from '../../../lib/api-response';

/** Directories to scan for content files */
const CONTENT_DIRS = [
  'src/content/posts',
  'src/content/projects',
  'src/content/services',
  'src/content/pages',
  'src/content/messages',
  'src/content/settings',
  'src/content/keywords',
];

/** Directories to scan for asset files */
const ASSET_DIRS = ['public/uploads'];

/** Config files to include */
const CONFIG_FILES = ['public/admin/config.yml'];

/** File extensions recognized as text (readable as UTF-8) */
const TEXT_EXTENSIONS = new Set([
  '.md', '.yml', '.yaml', '.json', '.toml', '.html', '.htm',
  '.txt', '.css', '.js', '.ts', '.jsx', '.tsx', '.svg', '.xml',
  '.csv', '.env', '.gitignore', '.editorconfig',
]);

/** Max file size to read as text (5 MB) */
const MAX_TEXT_SIZE = 5 * 1024 * 1024;

function sha1(content: string | Buffer): string {
  return crypto.createHash('sha1').update(content).digest('hex');
}

function isTextFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return TEXT_EXTENSIONS.has(ext);
}

interface FileEntry {
  path: string;
  sha: string;
  size: number;
  name: string;
  text?: string;
}

function scanDirectory(dir: string, baseDir: string): FileEntry[] {
  const results: FileEntry[] = [];
  const fullPath = path.join(baseDir, dir);

  if (!fs.existsSync(fullPath)) return results;

  try {
    const entries = fs.readdirSync(fullPath, { withFileTypes: true });
    for (const entry of entries) {
      const relPath = path.join(dir, entry.name).replace(/\\/g, '/');
      if (entry.isDirectory()) {
        results.push(...scanDirectory(relPath, baseDir));
      } else if (entry.isFile()) {
        const absPath = path.join(fullPath, entry.name);
        const stat = fs.statSync(absPath);
        let text: string | undefined;
        let sha = '';

        if (isTextFile(relPath) && stat.size <= MAX_TEXT_SIZE) {
          text = fs.readFileSync(absPath, 'utf8');
          sha = sha1(text);
        } else {
          // For binary files, read a small chunk for the hash
          const buf = fs.readFileSync(absPath);
          sha = sha1(buf);
        }

        results.push({
          path: relPath,
          sha,
          size: stat.size,
          name: entry.name,
          ...(text !== undefined ? { text } : {}),
        });
      }
    }
  } catch {
    // Skip directories we can't read
  }

  return results;
}

function ensureDir(filePath: string) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
}

export const GET: APIRoute = async ({ request }) => {
  const user = verifyToken(request);
  if (!user) {
    return apiError('未授权', 401);
  }

  const url = new URL(request.url);
  const listMode = url.searchParams.get('list');
  const filePath = url.searchParams.get('path');
  const mediaPath = url.searchParams.get('media');

  const cwd = process.cwd();

  // Return a single media (binary) file
  if (mediaPath) {
    let absPath = path.join(cwd, mediaPath);

    // If file not found at original path, search date subdirectories
    if (!fs.existsSync(absPath)) {
      const dir = path.dirname(absPath);
      const name = path.basename(mediaPath);
      if (fs.existsSync(dir)) {
        const found = fs.readdirSync(dir, { withFileTypes: true })
          .filter(d => d.isDirectory() && /^\d{8}$/.test(d.name))
          .sort((a, b) => b.name.localeCompare(a.name)) // newest first
          .map(d => path.join(dir, d.name, name))
          .find(p => fs.existsSync(p));
        if (found) absPath = found;
      }
    }

    if (!fs.existsSync(absPath)) {
      return new Response('File not found', { status: 404 });
    }
    const buf = fs.readFileSync(absPath);
    const ext = path.extname(mediaPath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
      '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
      '.pdf': 'application/pdf', '.ico': 'image/x-icon',
    };
    return new Response(buf, {
      headers: { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' },
    });
  }

  // Return a single text file
  if (filePath) {
    const absPath = path.join(cwd, filePath);
    if (!fs.existsSync(absPath)) {
      return apiError('File not found', 404);
    }
    const stat = fs.statSync(absPath);
    const content = fs.readFileSync(absPath, 'utf8');
    return apiSuccess({
      path: filePath,
      sha: sha1(content),
      size: stat.size,
      name: path.basename(filePath),
      text: content,
    });
  }

  // List all files (recursive scan)
  if (listMode === 'true') {
    const files: FileEntry[] = [];

    for (const dir of CONTENT_DIRS) {
      files.push(...scanDirectory(dir, cwd));
    }
    for (const dir of ASSET_DIRS) {
      const scanned = scanDirectory(dir, cwd);
      // Exclude thumbnail files from the media library
      files.push(...scanned.filter(f => !f.name.includes('_thumb')));
    }
    for (const file of CONFIG_FILES) {
      const absPath = path.join(cwd, file);
      if (fs.existsSync(absPath)) {
        const stat = fs.statSync(absPath);
        const content = fs.readFileSync(absPath, 'utf8');
        files.push({
          path: file,
          sha: sha1(content),
          size: stat.size,
          name: path.basename(file),
          text: content,
        });
      }
    }

    return apiSuccess({ files });
  }

  return apiError('Missing parameter: use ?list=true or ?path=...', 400);
};

export const PUT: APIRoute = async ({ request }) => {
  const user = verifyToken(request);
  if (!user) {
    return apiError('未授权', 401);
  }

  const url = new URL(request.url);
  const filePath = url.searchParams.get('path');

  if (!filePath) {
    return apiError('Missing path parameter', 400);
  }

  const cwd = process.cwd();
  const absPath = path.join(cwd, filePath);
  const contentType = request.headers.get('Content-Type') || '';

  try {
    if (contentType.includes('application/json')) {
      const body = await request.json();
      ensureDir(absPath);
      fs.writeFileSync(absPath, body.text || body.data || '', 'utf8');
    } else {
      const buf = Buffer.from(await request.arrayBuffer());
      ensureDir(absPath);
      fs.writeFileSync(absPath, buf);
    }

    // Auto-rename image: move to date folder + timestamp + generate thumbnail
    let finalPath = filePath;
    if (isImage(filePath) && fs.existsSync(absPath)) {
      const result = await processUploadedImage(absPath);
      if (result) {
        const dir = path.dirname(filePath);
        finalPath = (dir + '/' + result.newPath).replace(/\\/g, '/');
      }
    }

    const finalAbs = path.join(process.cwd(), finalPath);
    const stat = fs.existsSync(finalAbs) ? fs.statSync(finalAbs) : fs.statSync(absPath);
    const content = fs.existsSync(finalAbs) ? fs.readFileSync(finalAbs) : fs.readFileSync(absPath);
    const newSha = sha1(content);

    return apiSuccess({
      path: finalPath,
      sha: newSha,
      size: stat.size,
    });
  } catch (e) {
    return apiError(`写入失败: ${(e as Error).message}`, 500);
  }
};

export const DELETE: APIRoute = async ({ request }) => {
  const user = verifyToken(request);
  if (!user) {
    return apiError('未授权', 401);
  }

  const url = new URL(request.url);
  const filePath = url.searchParams.get('path');

  if (!filePath) {
    return apiError('Missing path parameter', 400);
  }

  const absPath = path.join(process.cwd(), filePath);

  try {
    if (fs.existsSync(absPath)) {
      fs.unlinkSync(absPath);
    }
    return apiSuccess({ success: true });
  } catch (e) {
    return apiError(`删除失败: ${(e as Error).message}`, 500);
  }
};
