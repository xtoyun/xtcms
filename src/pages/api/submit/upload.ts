export const prerender = false;

import type { APIRoute } from 'astro';
import fs from 'node:fs';
import path from 'node:path';
import { processUploadedImage, isImage } from '../../../lib/image-utils';
import { apiError, apiSuccess } from '../../../lib/api-response';

const API_KEY = process.env.CMS_API_KEY || 'xtocn-api-key-change-me';

export const POST: APIRoute = async ({ request }) => {
  const auth = request.headers.get('Authorization');
  const key = auth?.startsWith('Bearer ') ? auth.slice(7) : '';
  if (key !== API_KEY) {
    return apiError('无效的 API Key', 401);
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return apiError('缺少 file 字段', 400);
    }

    // Save to temp location, then process
    const uploadDir = path.join(process.cwd(), 'public/uploads');
    fs.mkdirSync(uploadDir, { recursive: true });
    const tmpPath = path.join(uploadDir, file.name);
    const buf = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(tmpPath, buf);

    if (isImage(tmpPath)) {
      const result = await processUploadedImage(tmpPath);
      if (result) {
        return apiSuccess({
          success: true,
          path: `public/uploads/${result.newPath}`,
          url: `/uploads/${result.newPath}`,
        });
      }
    }

    // Not an image — save as-is
    return apiSuccess({
      success: true,
      path: `public/uploads/${file.name}`,
      url: `/uploads/${file.name}`,
    });
  } catch (e) {
    return apiError(`上传失败: ${(e as Error).message}`, 500);
  }
};
