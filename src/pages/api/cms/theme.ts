import type { APIRoute } from 'astro';
import fs from 'node:fs';
import path from 'node:path';
import { verifyToken } from './auth';
import { getMergedCustomizable } from '../../../core/template-registry';
import { parseYAML } from '../../../core/content';

/**
 * GET /api/cms/theme
 * Get current theme settings (merged customizable defaults + user values).
 */
export const GET: APIRoute = async ({ request }) => {
  const user = verifyToken(request);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const customizable = getMergedCustomizable();
  const cwd = process.cwd();

  // Read user customizations from theme.yml
  let userValues: Record<string, any> = {};
  const themePath = path.join(cwd, 'src/content/settings/theme.yml');
  if (fs.existsSync(themePath)) {
    try {
      userValues = parseYAML(fs.readFileSync(themePath, 'utf8'));
    } catch { /* ignore parse errors */ }
  }

  // Build response: for each customizable field, show default + user value
  const settings: any[] = [];
  for (const [group, fields] of Object.entries(customizable)) {
    for (const field of fields) {
      const key = `theme_${field.name}`;
      settings.push({
        group,
        name: field.name,
        label: field.label,
        type: field.type,
        default: field.default,
        value: userValues[key] !== undefined ? userValues[key] : field.default,
        options: field.options,
        min: field.min,
        max: field.max,
      });
    }
  }

  return new Response(JSON.stringify({ settings }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

/**
 * PUT /api/cms/theme
 * Save theme settings to theme.yml.
 */
export const PUT: APIRoute = async ({ request }) => {
  const user = verifyToken(request);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json().catch(() => ({}));
  const { settings } = body; // { "theme_primary": "#ff0000", "theme_bg": "#ffffff", ... }

  if (!settings || typeof settings !== 'object') {
    return new Response(JSON.stringify({ error: 'Missing settings object' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const cwd = process.cwd();
  const themePath = path.join(cwd, 'src/content/settings/theme.yml');

  // Convert flat object to YAML
  const lines = Object.entries(settings).map(([key, value]) => {
    const val = typeof value === 'boolean' ? String(value) : String(value);
    return `${key}: "${val.replace(/"/g, '\\"')}"`;
  });

  fs.mkdirSync(path.dirname(themePath), { recursive: true });
  fs.writeFileSync(themePath, lines.join('\n'), 'utf8');

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
