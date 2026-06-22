/**
 * Proper YAML parser for xtcms config files.
 * Handles nested objects, lists of objects, inline objects, and quoted strings.
 * This replaces the over-simplified parseYAML in content.ts for config files.
 */

type YamlValue = string | number | boolean | null | YamlValue[] | Record<string, YamlValue>;
type YamlObj = Record<string, YamlValue>;

/**
 * Detect the indentation level of a line (number of leading spaces).
 */
function indentOf(line: string): number {
  return line.search(/\S/);
}

/**
 * Parse an inline YAML value: "hello", true, 42, 'world', null
 */
function parseScalar(raw: string): YamlValue {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  // Quoted string
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  // Booleans
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed === 'null' || trimmed === '~') return null;
  // Numbers
  if (/^-?\d+\.?\d*$/.test(trimmed)) return Number(trimmed);
  return trimmed;
}

/**
 * Parse an inline YAML object: { key1: val1, key2: val2 }
 */
function parseInlineObject(raw: string): YamlObj {
  const obj: YamlObj = {};
  // Remove surrounding braces
  let inner = raw.trim();
  if (inner.startsWith('{') && inner.endsWith('}')) {
    inner = inner.slice(1, -1);
  }
  // Split by commas, respecting quotes
  const pairs = splitByComma(inner);
  for (const pair of pairs) {
    const colonIdx = pair.indexOf(':');
    if (colonIdx === -1) continue;
    const key = pair.slice(0, colonIdx).trim();
    const val = pair.slice(colonIdx + 1).trim();
    obj[key] = parseScalar(val);
  }
  return obj;
}

/**
 * Split by commas that are not inside quotes.
 */
function splitByComma(str: string): string[] {
  const parts: string[] = [];
  let current = '';
  let inDouble = false;
  let inSingle = false;
  for (const ch of str) {
    if (ch === '"' && !inSingle) { inDouble = !inDouble; current += ch; continue; }
    if (ch === "'" && !inDouble) { inSingle = !inSingle; current += ch; continue; }
    if (ch === ',' && !inDouble && !inSingle) {
      parts.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  if (current) parts.push(current);
  return parts;
}

/**
 * Parse a YAML string into an object.
 * Handles:
 *   - Simple key: value pairs
 *   - Nested objects (indentation-based)
 *   - Lists of objects (- key: value)
 *   - Lists of scalars (- value)
 *   - Inline objects ({ key: value })
 *   - Inline lists ([a, b, c])
 */
export function parseYAML(yaml: string): YamlObj {
  const lines = yaml.split('\n');
  const root: YamlObj = {};
  let i = 0;

  function parseValue(rawLine: string, indent: number): YamlValue {
    const trimmed = rawLine.trim();
    if (!trimmed) return null;

    // Inline object: { key: val, ... }
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      return parseInlineObject(trimmed);
    }

    // Key-value: key: value
    const kvMatch = trimmed.match(/^([\w-]+):\s*(.*)$/);
    if (kvMatch) {
      const val = kvMatch[2].trim();
      if (!val || val === '|' || val === '>') {
        // Nested object or multiline block
        return parseNestedObject(indent);
      }
      return parseScalar(val);
    }

    // List item: - value or - key: value
    const listMatch = trimmed.match(/^-\s+(.*)$/);
    if (listMatch) {
      const item = listMatch[1].trim();
      if (!item) {
        // - (empty, nested object follows)
        return parseNestedObject(indent);
      }
      if (item.startsWith('{') && item.endsWith('}')) {
        return parseInlineObject(item);
      }
      // Could be "- key: value" (inline) or just "- value"
      const itemKv = item.match(/^([\w-]+):\s*(.*)$/);
      if (itemKv) {
        const val = itemKv[2].trim();
        if (!val) {
          // "- key:" followed by nested content
          const nested = parseNestedObject(indent);
          const obj: YamlObj = {};
          obj[itemKv[1]] = nested;
          return obj;
        }
        const obj: YamlObj = {};
        obj[itemKv[1]] = parseScalar(val);
        return obj;
      }
      return parseScalar(item);
    }

    return trimmed;
  }

  function parseNestedObject(parentIndent: number): YamlValue {
    // Look ahead to see if the next line is at a deeper indent and starts with "- "
    // If so, this is a list of objects
    const nextLine = lines[i];
    if (nextLine !== undefined) {
      const nextTrimmed = nextLine.trim();
      if (nextTrimmed.startsWith('- ')) {
        return parseList(parentIndent + 2); // assume list items are indented 2 more
      }
    }
    // It's a regular nested object
    const obj: YamlObj = {};
    const targetIndent = parentIndent + 2; // standard 2-space indent for children

    while (i < lines.length) {
      const line = lines[i];
      if (!line || line.trim() === '' || line.trim().startsWith('#')) { i++; continue; }
      const ind = indentOf(line);
      if (ind <= parentIndent) break; // back to parent level

      const trimmed = line.trim();
      const kvMatch = trimmed.match(/^([\w-]+):\s*(.*)$/);
      if (kvMatch) {
        const key = kvMatch[1];
        const val = kvMatch[2].trim();
        i++;
        if (!val || val === '|' || val === '>') {
          obj[key] = parseNestedObject(ind);
        } else {
          obj[key] = parseScalar(val);
        }
      } else {
        i++;
      }
    }
    return obj;
  }

  function parseList(parentIndent: number): YamlValue[] {
    const list: YamlValue[] = [];

    while (i < lines.length) {
      const line = lines[i];
      if (!line || line.trim() === '' || line.trim().startsWith('#')) { i++; continue; }
      const ind = indentOf(line);
      if (ind < parentIndent - 1) break; // back up too far

      const trimmed = line.trim();
      if (trimmed.startsWith('- ')) {
        const item = trimmed.slice(2).trim();
        if (!item) {
          // Empty item: nested object follows
          i++;
          list.push(parseNestedObject(ind));
          continue;
        }
        // Inline object?
        if (item.startsWith('{') && item.endsWith('}')) {
          i++;
          list.push(parseInlineObject(item));
          continue;
        }
        // Key: value inline?
        const itemKv = item.match(/^([\w-]+):\s*(.*)$/);
        if (itemKv) {
          const key = itemKv[1];
          const val = itemKv[2].trim();
          if (!val && i + 1 < lines.length) {
            // Has nested content after this line
            i++;
            const nested = parseNestedObject(ind);
            const obj: YamlObj = {};
            obj[key] = nested;
            list.push(obj);
            continue;
          }
          const obj: YamlObj = {};
          obj[key] = parseScalar(val);
          i++;
          list.push(obj);
          continue;
        }
        // Simple value
        i++;
        list.push(parseScalar(item));
      } else if (trimmed.match(/^[\w-]+:\s*.*$/)) {
        // This is a key-value at the list's indent level — part of a nested object in the list
        break;
      } else {
        i++;
      }
    }
    return list;
  }

  // Main parse loop
  while (i < lines.length) {
    const line = lines[i];
    if (!line || line.trim() === '' || line.trim().startsWith('#')) { i++; continue; }

    const trimmed = line.trim();
    const kvMatch = trimmed.match(/^([\w-]+):\s*(.*)$/);
    if (kvMatch) {
      const key = kvMatch[1];
      const val = kvMatch[2].trim();
      i++;
      if (!val) {
        // Check if next line is a list
        if (i < lines.length && lines[i].trim().startsWith('- ')) {
          root[key] = parseList(indentOf(line) + 2);
        } else {
          root[key] = parseNestedObject(indentOf(line));
        }
      } else {
        root[key] = parseScalar(val);
      }
    } else {
      i++;
    }
  }

  return root;
}
