import fs from 'node:fs';
import path from 'node:path';
import {
  resolveTemplateChain,
  getTemplateCollections,
  getMergedCustomizable,
  type CustomizableConfig,
} from './template-registry';
import { load as parseYAML } from 'js-yaml';

/**
 * Simple YAML stringifier. Handles the config.yml structure we need.
 */
function stringifyYAML(obj: any, indent = 0): string {
  const pad = '  '.repeat(indent);
  const lines: string[] = [];

  if (obj === null || obj === undefined) return '';

  if (Array.isArray(obj)) {
    for (const item of obj) {
      if (typeof item === 'object' && item !== null) {
        lines.push(`${pad}-`);
        lines.push(stringifyYAML(item, indent + 1).split('\n').map(l => l ? `  ${l}` : l).join('\n'));
      } else {
        lines.push(`${pad}- ${formatScalar(item)}`);
      }
    }
  } else if (typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj)) {
      if (value === null || value === undefined) continue;
      if (Array.isArray(value)) {
        if (value.length === 0) {
          lines.push(`${pad}${key}: []`);
        } else if (typeof value[0] === 'object') {
          lines.push(`${pad}${key}:`);
          for (const item of value) {
            lines.push(`${pad}  -`);
            lines.push(stringifyYAML(item, indent + 2));
          }
        } else {
          lines.push(`${pad}${key}:`);
          for (const item of value) {
            lines.push(`${pad}  - ${formatScalar(item)}`);
          }
        }
      } else if (typeof value === 'object') {
        lines.push(`${pad}${key}:`);
        lines.push(stringifyYAML(value, indent + 1));
      } else {
        lines.push(`${pad}${key}: ${formatScalar(value)}`);
      }
    }
  }

  return lines.join('\n');
}

function formatScalar(value: any): string {
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') {
    if (!value) return "''";
    // Quote strings with special chars that would break YAML
    if (/[:#{}[\]&*!|>'\"%@`,\n]/.test(value) || value.startsWith('-') || value.startsWith('{') || value.startsWith('[')) {
      // Use single quotes for strings containing double quotes
      if (value.includes('"')) {
        return `'${value}'`;
      }
      return `"${value}"`;
    }
    return value;
  }
  return String(value);
}

// ── Core xtcms config ──

const CORE_CONFIG = {
  backend: { name: 'server-api' },
  media_folder: 'public/uploads',
  public_folder: '/uploads',
  logo: { src: '/logo.svg' },
  app_title: '雄韬智网',
  slug: {
    encoding: 'ascii',
    clean_accents: true,
    sanitize_replacement: '-',
    lowercase: true,
  },
};

/**
 * Generate the complete Sveltia CMS config.yml by merging the template chain.
 */
export function generateCMSConfig(templateName?: string): string {
  const activeName = templateName || resolveTemplateChain()[resolveTemplateChain().length - 1];
  const chain = resolveTemplateChain(activeName);

  // Start with core config
  const config: Record<string, any> = JSON.parse(JSON.stringify(CORE_CONFIG));

  // Merge collections from each template in chain order (root → child)
  const allFolderCollections: Record<string, any> = {};
  const allFileSettings: any[] = [];

  for (const tplName of chain) {
    const tplCollections = getTemplateCollections(tplName);

    // Merge folder collections
    if (tplCollections.collections && Array.isArray(tplCollections.collections)) {
      for (const col of tplCollections.collections) {
        if (!col.folder) continue; // Skip file collections at this stage
        const existing = allFolderCollections[col.name];
        if (existing) {
          // Child adds fields to parent's collection
          const mergedFields = [...existing.fields];
          if (col.fields && Array.isArray(col.fields)) {
            for (const field of col.fields) {
              const fi = mergedFields.findIndex((f: any) => f.name === field.name);
              if (fi >= 0) mergedFields[fi] = field;
              else mergedFields.push(field);
            }
          }
          allFolderCollections[col.name] = { ...existing, ...col, fields: mergedFields };
        } else {
          allFolderCollections[col.name] = { ...col };
        }
      }
    }

    // Merge file-based settings
    if (tplCollections.settings && Array.isArray(tplCollections.settings)) {
      for (const s of tplCollections.settings) {
        const existingIdx = allFileSettings.findIndex((es: any) => es.name === s.name);
        if (existingIdx >= 0) {
          const mergedFields = [...allFileSettings[existingIdx].fields];
          if (s.fields && Array.isArray(s.fields)) {
            for (const field of s.fields) {
              const fi = mergedFields.findIndex((f: any) => f.name === field.name);
              if (fi >= 0) mergedFields[fi] = field;
              else mergedFields.push(field);
            }
          }
          allFileSettings[existingIdx] = { ...allFileSettings[existingIdx], ...s, fields: mergedFields };
        } else {
          allFileSettings.push({ ...s });
        }
      }
    }
  }

  // Ensure core settings exist
  if (!allFileSettings.find((s: any) => s.name === 'general')) {
    allFileSettings.push({
      name: 'general',
      label: '基本信息',
      file: 'src/content/settings/general.yml',
      fields: [
        { label: '网站标题', name: 'site_title', widget: 'string' },
        { label: '网站描述', name: 'site_description', widget: 'text', required: 'false' },
        { label: 'ICP备案号', name: 'icp', widget: 'string', required: 'false' },
        { label: '公安备案号', name: 'police', widget: 'string', required: 'false' },
        { label: '联系邮箱', name: 'email', widget: 'string', required: 'false' },
        { label: '联系电话', name: 'phone', widget: 'string', required: 'false' },
      ],
    });
  }

  // Add theme settings from customizable
  const customizable = getMergedCustomizable(chain);
  if (Object.keys(customizable).length > 0) {
    const themeFields = customizableToFields(customizable);
    allFileSettings.push({
      name: 'theme',
      label: '主题设置',
      file: 'src/content/settings/theme.yml',
      fields: themeFields,
    });
  }

  // Build final config — group all file settings under one "settings" collection
  config.collections = [...Object.values(allFolderCollections)];

  if (allFileSettings.length > 0) {
    config.collections.push({
      name: 'settings',
      label: '站点设置',
      label_singular: '设置项',
      editor: { preview: false },
      files: allFileSettings.map(s => ({
        name: s.name,
        label: s.label || s.name,
        file: s.file,
        fields: s.fields,
      })),
    });
  }

  return stringifyYAML(config);
}

function customizableToFields(customizable: CustomizableConfig): any[] {
  const fields: any[] = [];
  for (const [, groupFields] of Object.entries(customizable)) {
    for (const field of groupFields) {
      const f: Record<string, any> = {
        label: field.label,
        name: `theme_${field.name}`,
        widget: field.type === 'select' ? 'select' : field.type === 'boolean' ? 'boolean' : field.type === 'number' ? 'number' : 'string',
        required: 'false' as any,
      };
      if (field.type === 'select' && field.options) f.options = field.options;
      if (field.default !== undefined) f.default = field.default;
      fields.push(f);
    }
  }
  return fields;
}

// ── Content config generation ──

/**
 * Generate Astro content.config.ts from the template chain.
 */
export function generateContentConfig(templateName?: string): string {
  const activeName = templateName || resolveTemplateChain()[resolveTemplateChain().length - 1];
  const chain = resolveTemplateChain(activeName);

  const folderCollections: any[] = [];
  const seen = new Set<string>();

  for (const tplName of chain) {
    const tplCollections = getTemplateCollections(tplName);
    if (tplCollections.collections && Array.isArray(tplCollections.collections)) {
      for (const col of tplCollections.collections) {
        if (col.folder && !seen.has(col.name)) {
          seen.add(col.name);
          folderCollections.push(col);
        }
      }
    }
  }

  const imports = [
    `import { defineCollection, z } from 'astro:content';`,
    `import { glob } from 'astro/loaders';`,
  ];
  const definitions: string[] = [];

  for (const col of folderCollections) {
    const schemaLines = (col.fields || []).map((field: any) => {
      let zodType = 'z.string()';
      const isRequired = field.required !== false && field.required !== 'false';
      switch (field.widget) {
        case 'number': zodType = 'z.number()'; break;
        case 'boolean': zodType = 'z.boolean()'; break;
        case 'datetime': zodType = 'z.coerce.date()'; break;
        case 'list': zodType = 'z.array(z.string())'; break;
        default: zodType = 'z.string()';
      }
      if (!isRequired) zodType += '.optional()';
      if (field.widget === 'list' && field.default !== undefined) zodType += `.default([])`;
      else if (field.widget === 'boolean' && field.default !== undefined) zodType += `.default(${field.default})`;
      return `    ${field.name}: ${zodType},`;
    });

    definitions.push(`
const ${col.name} = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './${col.folder}' }),
  schema: z.object({
${schemaLines.join('\n')}
  }),
});`);
  }

  const names = folderCollections.map(c => c.name);
  const exports = `export const collections = { ${names.join(', ')} };`;

  return [...imports, ...definitions, exports].join('\n');
}

// ── Theme CSS variables ──

/**
 * Read theme.yml and generate CSS variable map from customizable defaults + user values.
 */
export function getThemeCSSVariables(): Record<string, string> {
  const chain = resolveTemplateChain();
  const customizable = getMergedCustomizable(chain);

  // Read user values from theme.yml
  let userValues: Record<string, any> = {};
  try {
    const themePath = path.join(process.cwd(), 'src/content/settings/theme.yml');
    if (fs.existsSync(themePath)) {
      userValues = parseYAML(fs.readFileSync(themePath, 'utf8'));
    }
  } catch {
    // Use defaults
  }

  const vars: Record<string, string> = {};
  for (const [, fields] of Object.entries(customizable)) {
    for (const field of fields) {
      const cssName = `--xt-${field.name}`;
      const userKey = `theme_${field.name}`;
      const value = userValues[userKey] ?? field.default ?? '';
      vars[cssName] = String(value);
    }
  }
  return vars;
}

/**
 * Generate a <style> tag string with CSS custom properties from theme values.
 */
export function generateThemeStyleTag(): string {
  const vars = getThemeCSSVariables();
  const declarations = Object.entries(vars)
    .map(([k, v]) => `    ${k}: ${v};`)
    .join('\n');
  if (!declarations) return '';
  return `<style is:inline>\n  :root {\n${declarations}\n  }\n</style>`;
}
