export const prerender = false;

import type { APIRoute } from 'astro';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const SECRET = process.env.CMS_SECRET || 'xtocn-cms-secret-change-in-production-2026';

/** Directories to scan for content files */
const CONTENT_DIRS = [
  'src/content/posts',
  'src/content/projects',
  'src/content/services',
  'src/content/pages',
  'src/content/messages',
  'src/content/settings',
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

function verifyToken(request: Request): { username: string } | null {
  const auth = request.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  const expected = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
  if (signature !== expected) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (Date.now() > data.exp) return null;
    return { username: data.username };
  } catch {
    return null;
  }
}

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
    return new Response(JSON.stringify({ error: '未授权' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const listMode = url.searchParams.get('list');
  const filePath = url.searchParams.get('path');
  const mediaPath = url.searchParams.get('media');

  const cwd = process.cwd();

  // Return a single media (binary) file
  if (mediaPath) {
    const absPath = path.join(cwd, mediaPath);
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
      return new Response(JSON.stringify({ error: 'File not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const stat = fs.statSync(absPath);
    const content = fs.readFileSync(absPath, 'utf8');
    return new Response(JSON.stringify({
      path: filePath,
      sha: sha1(content),
      size: stat.size,
      name: path.basename(filePath),
      text: content,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // List all files (recursive scan)
  if (listMode === 'true') {
    const files: FileEntry[] = [];

    for (const dir of CONTENT_DIRS) {
      files.push(...scanDirectory(dir, cwd));
    }
    for (const dir of ASSET_DIRS) {
      files.push(...scanDirectory(dir, cwd));
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

    return new Response(JSON.stringify({ files }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ error: 'Missing parameter: use ?list=true or ?path=...' }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const PUT: APIRoute = async ({ request }) => {
  const user = verifyToken(request);
  if (!user) {
    return new Response(JSON.stringify({ error: '未授权' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const filePath = url.searchParams.get('path');

  if (!filePath) {
    return new Response(JSON.stringify({ error: 'Missing path parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
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

    const stat = fs.statSync(absPath);
    const content = fs.readFileSync(absPath);
    const newSha = sha1(content);

    return new Response(JSON.stringify({
      path: filePath,
      sha: newSha,
      size: stat.size,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: `写入失败: ${(e as Error).message}` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const DELETE: APIRoute = async ({ request }) => {
  const user = verifyToken(request);
  if (!user) {
    return new Response(JSON.stringify({ error: '未授权' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const filePath = url.searchParams.get('path');

  if (!filePath) {
    return new Response(JSON.stringify({ error: 'Missing path parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const absPath = path.join(process.cwd(), filePath);

  try {
    if (fs.existsSync(absPath)) {
      fs.unlinkSync(absPath);
    }
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: `删除失败: ${(e as Error).message}` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
