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

  // Simple YAML parser for flat key: value pairs + arrays + inline objects
  const lines = fm.split('\n');
  let currentKey = '';
  let inList = false;
  let listItems: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // List item: "  - value"
    const listMatch = line.match(/^\s+-\s+(.+)$/);
    if (listMatch && currentKey) {
      listItems.push(listMatch[1].trim().replace(/^["']|["']$/g, ''));
      continue;
    }

    // Flush pending list
    if (listItems.length > 0 && currentKey) {
      data[currentKey] = listItems;
      listItems = [];
    }

    // Key-value pair: "key: value"
    const kvMatch = line.match(/^(\w[\w-]*):\s*(.*)\s*$/);
    if (kvMatch) {
      currentKey = kvMatch[1];
      let val = (kvMatch[2] || '').trim();

      // Handle empty value (might be the start of a nested structure)
      if (!val) continue;

      // Strip surrounding quotes
      val = val.replace(/^["'](.*)["']$/, '$1');
      // Skip empty values (prevents schema errors from empty strings)
      if (val === '' || val === "''" || val === '""') continue;
      // Parse booleans
      if (val === 'true') { data[currentKey] = true; }
      else if (val === 'false') { data[currentKey] = false; }
      // Parse numbers (but not dates like 2026-06-21)
      else if (/^-?\d+\.?\d*$/.test(val) && !val.includes('-')) { data[currentKey] = Number(val); }
      else { data[currentKey] = val; }
    }
  }

  // Flush final pending list
  if (listItems.length > 0 && currentKey) {
    data[currentKey] = listItems;
  }

  return { data, body };
}

export interface ContentItem {
  id: string;
  slug: string;
  data: Record<string, any>;
  body: string;
  collection: string;
}

/**
 * Content cache to avoid re-reading files on every request during SSR.
 */
const contentCache = new Map<string, { mtime: Date; items: ContentItem[] }>();

/**
 * Read all markdown files from a collection directory.
 * Caches results and invalidates by file modification time.
 */
export function getContent(collectionName: string, dirPath: string): ContentItem[] {
  const absPath = path.join(process.cwd(), dirPath);
  if (!fs.existsSync(absPath)) return [];

  // Check cache
  const cached = contentCache.get(dirPath);
  if (cached) {
    let allMatch = true;
    try {
      const files = fs.readdirSync(absPath).filter(f => f.endsWith('.md'));
      for (const f of files) {
        const stat = fs.statSync(path.join(absPath, f));
        if (stat.mtime > cached.mtime) { allMatch = false; break; }
      }
      if (allMatch && files.length === cached.items.length) return cached.items;
    } catch { /* cache miss */ }
  }

  const items = fs.readdirSync(absPath)
    .filter(f => f.endsWith('.md'))
    .map(f => {
      const raw = fs.readFileSync(path.join(absPath, f), 'utf8');
      const { data, body } = parseFrontmatter(raw);
      const id = f.replace(/\.md$/, '');
      data._slug = id;
      // Clean up empty/invalid image values
      if (data.image === '' || data.image === null || data.image === undefined) {
        delete data.image;
      }
      return { id, slug: id, data, body, collection: collectionName };
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

  contentCache.set(dirPath, { mtime: new Date(), items });
  return items;
}

/**
 * Read a single YAML or Markdown file from a path.
 * For file-based collections (like settings).
 */
export function getFileContent(filePath: string): Record<string, any> | null {
  const absPath = path.join(process.cwd(), filePath);
  if (!fs.existsSync(absPath)) return null;

  const raw = fs.readFileSync(absPath, 'utf8');

  if (filePath.endsWith('.yml') || filePath.endsWith('.yaml')) {
    const data: Record<string, any> = {};
    const lines = raw.split('\n');
    for (const line of lines) {
      const match = line.match(/^(\w[\w-]*):\s*(.*)\s*$/);
      if (match) {
        let val = match[2] || '';
        // Strip surrounding single or double quotes
        val = val.replace(/^["'](.*)["']$/, '$1').replace(/^['']$/, '');
        if (val === 'true') data[match[1]] = true;
        else if (val === 'false') data[match[1]] = false;
        else if (val === '') { /* skip empty values */ }
        else data[match[1]] = val;
      }
    }
    return data;
  }

  const { data, body } = parseFrontmatter(raw);
  return { ...data, body, content: body };
}

/**
 * Parse a YAML string to an object (used for reading collections.yml, template.yml).
 * Simple parser supporting nested objects via indentation (2 spaces).
 */
export function parseYAML(yaml: string): Record<string, any> {
  const lines = yaml.split('\n');
  const result: Record<string, any> = {};
  const stack: { key: string; obj: Record<string, any>; indent: number }[] = [];

  let currentObj = result;
  let currentIndent = 0;
  let listKey = '';
  let listItems: any[] = [];

  function flushList() {
    if (listKey && listItems.length > 0) {
      setNestedValue(currentObj, listKey, listItems);
      listItems = [];
      listKey = '';
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith('#')) continue;

    const indent = line.search(/\S/);
    const trimmed = line.trim();

    // Pop stack if indent decreased
    while (stack.length > 0 && indent <= stack[stack.length - 1].indent) {
      const popped = stack.pop()!;
      currentObj = popped.obj;
      currentIndent = popped.indent;
    }

    // List item
    const listMatch = trimmed.match(/^-\s+(.*)$/);
    if (listMatch) {
      flushList();
      const item = parseInlineValue(listMatch[1].trim());
      // Check if next item is a nested object
      listItems.push(item);
      if (!listKey) {
        // We need to figure out the parent key from context
        // This is simplified — for collections.yml we handle lists at top level
      }
      continue;
    }

    // Key-value
    const kvMatch = trimmed.match(/^([\w-]+):\s*(.*)$/);
    if (kvMatch) {
      flushList();
      const key = kvMatch[1];
      const rawVal = kvMatch[2].trim();

      if (rawVal === '') {
        // Nested object starts
        const newObj: Record<string, any> = {};
        currentObj[key] = newObj;
        stack.push({ key, obj: currentObj, indent: currentIndent });
        currentObj = newObj;
        currentIndent = indent;
      } else {
        currentObj[key] = parseInlineValue(rawVal);
      }
    }
  }

  flushList();
  return result;
}

function parseInlineValue(val: string): any {
  val = val.replace(/^["'](.*)["']$/, '$1');
  if (val === 'true') return true;
  if (val === 'false') return false;
  if (/^-?\d+\.?\d*$/.test(val)) return Number(val);
  return val;
}

function setNestedValue(obj: Record<string, any>, keyPath: string, value: any) {
  obj[keyPath] = value;
}
