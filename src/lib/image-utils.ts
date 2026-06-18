import sharp from 'sharp';
import path from 'node:path';
import fs from 'node:fs';

const THUMB_WIDTH = 300;
const IMG_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif']);

export function isImage(filePath: string): boolean {
  return IMG_EXTS.has(path.extname(filePath).toLowerCase());
}

export function todayFolder(): string {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
}

export function timestampFilename(originalName: string): string {
  const ext = path.extname(originalName);
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}${String(now.getMilliseconds()).padStart(3, '0')}${ext}`;
}

export async function processUploadedImage(absPath: string): Promise<{ newPath: string; thumbPath: string } | null> {
  if (!isImage(absPath)) return null;

  const baseDir = path.dirname(absPath);
  const parentDir = path.basename(baseDir);
  const ext = path.extname(absPath);

  // Already in date folder — only generate thumbnail
  if (/^\d{8}$/.test(parentDir)) {
    const name = path.basename(absPath);
    const thumbName = name.replace(ext, `_thumb${ext === '.png' ? '.jpg' : ext}`);
    const thumbAbsPath = path.join(baseDir, thumbName);
    if (fs.existsSync(thumbAbsPath)) {
      return { newPath: `${parentDir}/${name}`, thumbPath: `${parentDir}/${thumbName}` };
    }
    try {
      await sharp(absPath).resize(THUMB_WIDTH, undefined, { withoutEnlargement: true }).jpeg({ quality: 75 }).toFile(thumbAbsPath);
      return { newPath: `${parentDir}/${name}`, thumbPath: `${parentDir}/${thumbName}` };
    } catch { return null; }
  }

  // New upload: move to date folder, keep original name
  const dateDir = todayFolder();
  let finalName = path.basename(absPath);
  const thumbName = finalName.replace(ext, `_thumb${ext === '.png' ? '.jpg' : ext}`);
  const dateAbsDir = path.join(baseDir, dateDir);
  fs.mkdirSync(dateAbsDir, { recursive: true });

  // If same name exists, use timestamp to avoid conflict
  if (fs.existsSync(path.join(dateAbsDir, finalName))) {
    finalName = timestampFilename(finalName);
  }

  try {
    fs.renameSync(absPath, path.join(dateAbsDir, finalName));
    await sharp(path.join(dateAbsDir, finalName))
      .resize(THUMB_WIDTH, undefined, { withoutEnlargement: true })
      .jpeg({ quality: 75 })
      .toFile(path.join(dateAbsDir, finalName.replace(ext, `_thumb${ext === '.png' ? '.jpg' : ext}`)));
    return {
      newPath: `${dateDir}/${finalName}`,
      thumbPath: `${dateDir}/${finalName.replace(ext, `_thumb${ext === '.png' ? '.jpg' : ext}`)}`,
    };
  } catch (e) {
    console.error('Image processing failed:', e);
    return null;
  }
}
