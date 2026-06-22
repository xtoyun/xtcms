import type { APIRoute } from 'astro';
import fs from 'node:fs';
import path from 'node:path';
import { verifyToken } from './auth';
import { execSync } from 'node:child_process';

/**
 * POST /api/cms/commit
 * Commit file changes (create/update/delete) to the filesystem and git.
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
  const { changes } = body;

  if (!Array.isArray(changes)) {
    return new Response(JSON.stringify({ error: 'Missing changes array' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const cwd = process.cwd();
  const results: Array<{ path: string; status: string }> = [];

  for (const change of changes) {
    const { action, path: filePath, data, encoding } = change;
    const absPath = path.join(cwd, filePath);

    try {
      switch (action) {
        case 'create':
        case 'update': {
          fs.mkdirSync(path.dirname(absPath), { recursive: true });
          if (encoding === 'base64' && typeof data === 'string') {
            fs.writeFileSync(absPath, Buffer.from(data, 'base64'));
          } else if (typeof data === 'string') {
            // Strip empty frontmatter values from markdown to avoid Astro schema errors
            const cleaned = /\.(md|yml|yaml)$/i.test(filePath) ? cleanFrontmatter(data) : data;
            fs.writeFileSync(absPath, cleaned, 'utf8');
          }
          results.push({ path: filePath, status: 'ok' });
          break;
        }
        case 'delete': {
          if (fs.existsSync(absPath)) {
            fs.unlinkSync(absPath);
          }
          results.push({ path: filePath, status: 'deleted' });
          break;
        }
        case 'rename': {
          const oldPath = path.join(cwd, change.previousPath);
          if (fs.existsSync(oldPath)) {
            fs.mkdirSync(path.dirname(absPath), { recursive: true });
            fs.renameSync(oldPath, absPath);
          }
          results.push({ path: filePath, status: 'renamed' });
          break;
        }
        default:
          results.push({ path: filePath, status: 'unknown action' });
      }
    } catch (e: any) {
      results.push({ path: filePath, status: `error: ${e.message}` });
    }
  }

  // Attempt git commit
  try {
    execSync('git add .', { cwd, timeout: 10000 });
    execSync(`git commit -m "CMS: content update by ${user.username}" --allow-empty`, {
      cwd,
      timeout: 10000,
    });
  } catch {
    // Git might not be available — that's OK, files are saved
  }

  return new Response(JSON.stringify({ results }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

/**
 * Remove empty/blank frontmatter fields to prevent Astro schema validation errors.
 * Fields like `image: ''`, `link: ''`, `date: ''` etc. are stripped.
 */
function cleanFrontmatter(content: string): string {
  if (!content.startsWith('---')) return content;

  const endIdx = content.indexOf('---', 3);
  if (endIdx === -1) return content;

  const fm = content.slice(3, endIdx);
  const body = content.slice(endIdx + 3);

  // Filter out lines with truly empty scalar values
  // Keep: blank lines, list items, array values like [] or [a,b], and keys with child items
  const lines = fm.split('\n').filter(line => {
    const trimmed = line.trim();
    if (!trimmed) return true; // keep blank lines
    if (trimmed.startsWith('- ')) return true; // keep list items
    const match = trimmed.match(/^[\w-]+:\s*(.*)$/);
    if (!match) return true; // keep non-kv lines
    const val = match[1].trim();
    // Only remove truly empty scalar strings
    if (val === "''" || val === '""') return false;
    // Don't remove empty arrays ([] is valid YAML) or empty objects
    return true;
  });

  return `---\n${lines.join('\n').trim()}\n---\n${body}`;
}
