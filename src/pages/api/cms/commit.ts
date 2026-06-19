export const prerender = false;

import type { APIRoute } from 'astro';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';

import { verifyToken } from '../../../lib/auth';
import { apiError, apiSuccess } from '../../../lib/api-response';

interface FileChange {
  action: 'create' | 'update' | 'move' | 'delete';
  path: string;
  previousPath?: string;
  previousSha?: string;
  data?: string; // base64 or text content
  encoding?: 'base64' | 'utf8';
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
    return apiError('未授权', 401);
  }

  try {
    const body = await request.json();
    const changes: FileChange[] = body.changes || [];

    if (!changes.length) {
      return apiError('No changes provided', 400);
    }

    const cwd = process.cwd();
    const results: Record<string, { sha: string }> = {};

    for (const change of changes) {
      const absPath = path.join(cwd, change.path);

      switch (change.action) {
        case 'delete': {
          if (fs.existsSync(absPath)) fs.unlinkSync(absPath);
          // Also delete thumbnail if exists
          const ext = path.extname(change.path);
          const thumbPath = absPath.replace(ext, `_thumb${ext === '.png' ? '.jpg' : ext}`);
          if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
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
          let fileToHash = absPath;
          // If file not at original path, search date folders (upload endpoint may have moved it)
          if (!fs.existsSync(absPath)) {
            const dir = path.dirname(absPath);
            const name = path.basename(change.path);
            if (fs.existsSync(dir)) {
              const found = fs.readdirSync(dir, { withFileTypes: true })
                .filter(d => d.isDirectory() && /^\d{8}$/.test(d.name))
                .sort((a, b) => b.name.localeCompare(a.name))
                .map(d => path.join(dir, d.name, name))
                .find(p => fs.existsSync(p));
              if (found) fileToHash = found;
            }
          }
          if (fs.existsSync(fileToHash)) {
            results[change.path] = { sha: sha1(fs.readFileSync(fileToHash)) };
          } else {
            results[change.path] = { sha: '' };
          }
          break;
        }
      }
    }

    // Collect all paths that were actually touched (for precise staging)
    const pathsToStage = new Set<string>();
    for (const change of changes) {
      const absPath = path.join(cwd, change.path);
      switch (change.action) {
        case 'delete': {
          pathsToStage.add(change.path);
          // Also include thumbnail if it exists
          const ext = path.extname(change.path);
          const thumbRel = change.path.replace(ext, `_thumb${ext === '.png' ? '.jpg' : ext}`);
          if (fs.existsSync(path.join(cwd, thumbRel))) {
            pathsToStage.add(thumbRel);
          }
          break;
        }
        case 'move': {
          if (change.previousPath) pathsToStage.add(change.previousPath);
          pathsToStage.add(change.path);
          break;
        }
        case 'create':
        case 'update': {
          // Use the actual on-disk path (may differ for uploads moved to date folders)
          let actualPath = change.path;
          if (!fs.existsSync(absPath)) {
            const dir = path.dirname(absPath);
            const name = path.basename(change.path);
            if (fs.existsSync(dir)) {
              const found = fs.readdirSync(dir, { withFileTypes: true })
                .filter(d => d.isDirectory() && /^\d{8}$/.test(d.name))
                .sort((a, b) => b.name.localeCompare(a.name))
                .map(d => path.join(dir, d.name, name))
                .find(p => fs.existsSync(p));
              if (found) actualPath = path.relative(cwd, found).replace(/\\/g, '/');
            }
          }
          if (fs.existsSync(path.join(cwd, actualPath))) {
            pathsToStage.add(actualPath);
          }
          break;
        }
      }
    }

    // Git auto-commit is disabled — files are saved to disk, manual commit required.
    // To re-enable, set environment variable: CMS_AUTO_COMMIT=true
    let commitSha = '';
    if (process.env.CMS_AUTO_COMMIT === 'true') {
      if (pathsToStage.size > 0) {
        try {
          const fileArgs = [...pathsToStage].map(p => `"${p}"`).join(' ');
          execSync(`git add -- ${fileArgs}`, { cwd, timeout: 10000 });
        } catch {
          try {
            execSync('git add -A', { cwd, timeout: 10000 });
          } catch { /* git may not be available */ }
        }
      }
      try {
        const diffCheck = execSync('git diff --cached --quiet', { cwd, timeout: 5000 });
      } catch {
        // git diff --cached --quiet exits with code 1 when there are changes
      }

      try {
        const authorName = user.username || 'CMS Admin';
        execSync(
          `git commit -m "CMS: content update" --author="${authorName} <cms@xtocn.com>"`,
          { cwd, timeout: 10000, env: { ...process.env, GIT_AUTHOR_NAME: authorName, GIT_AUTHOR_EMAIL: 'cms@xtocn.com', GIT_COMMITTER_NAME: authorName, GIT_COMMITTER_EMAIL: 'cms@xtocn.com' } },
        );
        const shaOutput = execSync('git rev-parse HEAD', { cwd, timeout: 5000, encoding: 'utf8' });
        commitSha = shaOutput.trim();

        // Auto push is also disabled — manual `git push` required.
        // To re-enable, set environment variable: CMS_AUTO_PUSH=true
        if (process.env.CMS_AUTO_PUSH === 'true') {
          try {
            execSync('git push', { cwd, timeout: 30000 });
          } catch {
            console.warn('CMS: git push failed, changes committed locally only');
          }
        }
      } catch (e) {
        console.warn('CMS: git commit failed:', (e as Error).message);
        commitSha = `local-${Date.now()}`;
      }
    } else {
      commitSha = `local-${Date.now()}`;
    }

    return apiSuccess({
      sha: commitSha,
      files: results,
    });
  } catch (e) {
    return apiError(`提交失败: ${(e as Error).message}`, 500);
  }
};
