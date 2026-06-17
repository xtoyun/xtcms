import fs from 'node:fs';
import path from 'node:path';

/**
 * Parse YAML frontmatter from a markdown file.
 * Returns data + body separately.
 */
function parseFrontmatter(raw: string): { data: Record<string, any>; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return { data: {}, body: raw };

  const fm = match[1];
  const body = raw.slice(match[0].length).trim();
  const data: Record<string, any> = {};

  // Simple YAML parser for flat key: value pairs + arrays
  const lines = fm.split('\n');
  let currentKey = '';
  let inArray = false;

  for (const line of lines) {
    const arrayMatch = line.match(/^\s+-\s+(.+)$/);
    if (arrayMatch && currentKey) {
      if (!Array.isArray(data[currentKey])) data[currentKey] = [];
      data[currentKey].push(arrayMatch[1].trim().replace(/^["']|["']$/g, ''));
      continue;
    }

    const kvMatch = line.match(/^(\w+):\s*(.*)\s*$/);
    if (kvMatch) {
      currentKey = kvMatch[1];
      let val = (kvMatch[2] || '').trim();
      // Strip surrounding quotes (single or double)
      val = val.replace(/^["'](.*)["']$/, '$1');
      // Parse booleans
      if (val === 'true') { data[currentKey] = true; }
      else if (val === 'false') { data[currentKey] = false; }
      else if (/^\d+$/.test(val)) { data[currentKey] = Number(val); }
      else { data[currentKey] = val; }
    }
  }

  return { data, body };
}

export interface ContentItem {
  id: string;
  slug: string;
  data: Record<string, any>;
  body: string;
}

/**
 * Read all markdown files from a directory.
 * Returns parsed content items sorted by pinned first, then by date descending.
 */
export function getContent(dirPath: string): ContentItem[] {
  const absPath = path.join(process.cwd(), dirPath);
  if (!fs.existsSync(absPath)) return [];

  return fs.readdirSync(absPath)
    .filter(f => f.endsWith('.md'))
    .map(f => {
      const raw = fs.readFileSync(path.join(absPath, f), 'utf8');
      const { data, body } = parseFrontmatter(raw);
      data._slug = f.replace(/\.md$/, '');
      // Clean up empty/invalid image values — treat empty strings as missing
      if (data.image === '' || data.image === null || data.image === undefined) {
        delete data.image;
      }
      return {
        id: f.replace(/\.md$/, ''),
        slug: f.replace(/\.md$/, ''),
        data,
        body,
      };
    })
    .sort((a, b) => {
      // Pinned items first
      const pinA = a.data.pinned ? 1 : 0;
      const pinB = b.data.pinned ? 1 : 0;
      if (pinA !== pinB) return pinB - pinA;
      // Then by date descending
      const dateA = a.data.date ? new Date(a.data.date).getTime() : 0;
      const dateB = b.data.date ? new Date(b.data.date).getTime() : 0;
      return dateB - dateA;
    });
}

/**
 * Get a single file from a file collection path (YAML or Markdown).
 */
export function getFileContent(filePath: string): Record<string, any> | null {
  const absPath = path.join(process.cwd(), filePath);
  if (!fs.existsSync(absPath)) return null;

  const raw = fs.readFileSync(absPath, 'utf8');

  if (filePath.endsWith('.yml') || filePath.endsWith('.yaml')) {
    // Simple YAML parser
    const data: Record<string, any> = {};
    const lines = raw.split('\n');
    for (const line of lines) {
      const match = line.match(/^(\w+):\s*["']?(.*)["']?\s*$/);
      if (match) {
        const val = match[2] || '';
        if (val === 'true') data[match[1]] = true;
        else if (val === 'false') data[match[1]] = false;
        else data[match[1]] = val;
      }
    }
    return data;
  }

  const { data, body } = parseFrontmatter(raw);
  return { ...data, body, content: body };
}
