export const prerender = false;

import type { APIRoute } from 'astro';
import fs from 'node:fs';
import path from 'node:path';
import { verifyToken } from '../../../lib/auth';
import { processUploadedImage } from '../../../lib/image-utils';
import { apiError, apiSuccess } from '../../../lib/api-response';

function ensureDir(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

export const POST: APIRoute = async ({ request }) => {
  const user = verifyToken(request);
  if (!user) {
    return apiError('未授权', 401);
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const targetPath = formData.get('path')?.toString() || 'public/uploads/upload.png';

    if (!file) {
      return apiError('No file provided', 400);
    }

    // Save to target directory temporarily
    const cwd = process.cwd();
    const targetDir = path.dirname(path.join(cwd, targetPath));
    ensureDir(path.join(targetDir, 'tmp'));
    const tmpPath = path.join(targetDir, file.name);

    const buf = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(tmpPath, buf);

    // Process: rename + thumbnail
    const result = await processUploadedImage(tmpPath);
    if (result) {
      const dir = path.dirname(targetPath);
      const finalPath = (dir + '/' + result.newPath).replace(/\\/g, '/').replace('public/', '');
      return apiSuccess({ path: 'public/' + finalPath });
    }

    // Not an image, write to target path directly
    const absPath = path.join(cwd, targetPath);
    ensureDir(absPath);
    fs.writeFileSync(absPath, buf);
    return apiSuccess({ path: targetPath });
  } catch (e) {
    return apiError(`上传失败: ${(e as Error).message}`, 500);
  }
};
