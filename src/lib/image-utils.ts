import sharp from 'sharp';
import path from 'node:path';

const THUMB_WIDTH = 300;
const IMG_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif']);

export function isImage(filePath: string): boolean {
  return IMG_EXTS.has(path.extname(filePath).toLowerCase());
}

/** Today's date folder: 20260618 */
export function todayFolder(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

/** Timestamp filename: YYYYMMDDHHmmssSSS.ext */
export function timestampFilename(originalName: string): string {
  const ext = path.extname(originalName);
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  const ms = String(now.getMilliseconds()).padStart(3, '0');
  return `${y}${m}${d}${h}${min}${s}${ms}${ext}`;
}

/**
 * Move image to date folder, rename to timestamp, generate thumbnail.
 * Returns { newPath, thumbPath } relative to the original base dir.
 */
export async function processUploadedImage(absPath: string): Promise<{ newPath: string; thumbPath: string } | null> {
  if (!isImage(absPath)) return null;

  const fs = await import('node:fs');
  const baseDir = path.dirname(absPath);
  const ext = path.extname(absPath);
  const dateDir = todayFolder();
  const newName = timestampFilename(path.basename(absPath));
  const thumbName = newName.replace(ext, `_thumb${ext === '.png' ? '.jpg' : ext}`);

  const dateAbsDir = path.join(baseDir, dateDir);
  fs.mkdirSync(dateAbsDir, { recursive: true });

  const newAbsPath = path.join(dateAbsDir, newName);
  const thumbAbsPath = path.join(dateAbsDir, thumbName);

  try {
    fs.renameSync(absPath, newAbsPath);

    await sharp(newAbsPath)
      .resize(THUMB_WIDTH, undefined, { withoutEnlargement: true })
      .jpeg({ quality: 75 })
      .toFile(thumbAbsPath);

    return {
      newPath: `${dateDir}/${newName}`,
      thumbPath: `${dateDir}/${thumbName}`,
    };
  } catch (e) {
    console.error('Image processing failed:', e);
    return null;
  }
}
