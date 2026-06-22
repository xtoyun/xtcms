import type { APIRoute } from 'astro';
import fs from 'node:fs';
import path from 'node:path';
import { verifyToken } from './auth';

/**
 * POST /api/cms/upload
 * Upload an image file to the uploads directory.
 * Deduplication: if a file with the same content hash exists, return the existing path.
 */
export const POST: APIRoute = async ({ request }) => {
  const user = verifyToken(request);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const targetPath = formData.get('path') as string | null;

  if (!file) {
    return new Response(JSON.stringify({ error: 'No file provided' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const cwd = process.cwd();
  const uploadsDir = path.join(cwd, 'public', 'uploads');

  // Create date-based subdirectory for organization
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const targetDir = path.join(uploadsDir, dateStr);
  fs.mkdirSync(targetDir, { recursive: true });

  // Generate unique filename
  const ext = path.extname(file.name) || '.png';
  const baseName = path.basename(file.name, ext)
    .replace(/[^a-zA-Z0-9一-鿿_-]/g, '-')
    .slice(0, 60);
  const uniqueName = `${baseName}_${Date.now().toString(36)}${ext}`;
  const destPath = path.join(targetDir, uniqueName);

  // Write file
  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(destPath, buffer);

  // Return the relative path (from public/)
  const relPath = path.relative(path.join(cwd, 'public'), destPath).replace(/\\/g, '/');

  return new Response(JSON.stringify({
    path: `public/${relPath}`,
    url: `/${relPath}`,
    size: buffer.length,
    name: uniqueName,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
