export const prerender = false;

import type { APIRoute } from 'astro';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';

import { CMS_SECRET } from '../../../lib/auth-config';
const SECRET = CMS_SECRET;

interface FileChange {
  action: 'create' | 'update' | 'move' | 'delete';
  path: string;
  previousPath?: string;
  previousSha?: string;
  data?: string; // base64 or text content
  encoding?: 'base64' | 'utf8';
}

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

function ensureDir(filePath: string) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
}

export const POST: APIRoute = async ({ request }) => {
  const user = verifyToken(request);
  if (!user) {
    return new Response(JSON.stringify({ error: '未授权' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json();
    const changes: FileChange[] = body.changes || [];

    if (!changes.length) {
      return new Response(JSON.stringify({ error: 'No changes provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const cwd = process.cwd();
    const results: Record<string, { sha: string }> = {};

    for (const change of changes) {
      const absPath = path.join(cwd, change.path);

      switch (change.action) {
        case 'delete': {
          if (fs.existsSync(absPath)) fs.unlinkSync(absPath);
          results[change.path] = { sha: '' };
          break;
        }
        case 'move': {
          if (change.previousPath) {
            const prevAbs = path.join(cwd, change.previousPath);
            if (fs.existsSync(prevAbs)) {
              ensureDir(absPath);
              fs.renameSync(prevAbs, absPath);
            }
          }
          if (fs.existsSync(absPath)) {
            results[change.path] = { sha: sha1(fs.readFileSync(absPath)) };
          }
          break;
        }
        case 'create':
        case 'update': {
          if (change.data !== undefined) {
            const buf = change.encoding === 'base64'
              ? Buffer.from(change.data, 'base64')
              : Buffer.from(change.data, 'utf8');
            ensureDir(absPath);
            fs.writeFileSync(absPath, buf);
          }
          if (fs.existsSync(absPath)) {
            results[change.path] = { sha: sha1(fs.readFileSync(absPath)) };
          } else {
            results[change.path] = { sha: '' };
          }
          break;
        }
      }
    }

    // Attempt git commit + push (non-blocking — continue even if git fails)
    let commitSha = '';
    try {
      execSync('git add -A', { cwd, timeout: 10000 });
      const diffCheck = execSync('git diff --cached --quiet', { cwd, timeout: 5000 });
      // If we reach here, there are no staged changes
    } catch {
      // git diff --cached --quiet exits with code 1 when there are changes — that's what we want
    }

    try {
      const authorName = user.username || 'CMS Admin';
      execSync(
        `git commit -m "CMS: content update" --author="${authorName} <cms@xtocn.com>"`,
        { cwd, timeout: 10000, env: { ...process.env, GIT_AUTHOR_NAME: authorName, GIT_AUTHOR_EMAIL: 'cms@xtocn.com', GIT_COMMITTER_NAME: authorName, GIT_COMMITTER_EMAIL: 'cms@xtocn.com' } },
      );
      const shaOutput = execSync('git rev-parse HEAD', { cwd, timeout: 5000, encoding: 'utf8' });
      commitSha = shaOutput.trim();

      // Try push (best effort)
      try {
        execSync('git push', { cwd, timeout: 30000 });
      } catch {
        // Push may fail if no remote or no network — that's OK
        console.warn('CMS: git push failed, changes committed locally only');
      }
    } catch (e) {
      // Git commit may fail if git is not configured — files are still saved
      console.warn('CMS: git commit failed:', (e as Error).message);
      commitSha = `local-${Date.now()}`;
    }

    return new Response(JSON.stringify({
      sha: commitSha,
      files: results,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: `提交失败: ${(e as Error).message}` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
