import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { AppError } from '@/lib/errors';
import { getStorage, type StoredFile } from '@/lib/storage';

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_DIMENSION = 4096;

export type UploadKind = 'duel' | 'avatar';

const OUTPUT: Record<UploadKind, { width: number; height: number; quality: number }> = {
  duel: { width: 1200, height: 1200, quality: 82 },
  avatar: { width: 256, height: 256, quality: 85 },
};

/**
 * Detects the real image type from the file's leading bytes.
 *
 * The client-supplied filename and Content-Type are never trusted: a `.jpg`
 * extension on an HTML or SVG payload is the classic stored-XSS vector.
 */
export function detectImageType(buffer: Buffer): 'jpeg' | 'png' | 'webp' | null {
  if (buffer.length < 12) return null;

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpeg';

  const pngMagic = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (pngMagic.every((byte, index) => buffer[index] === byte)) return 'png';

  if (
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'webp';
  }

  return null;
}

/**
 * Validates and normalises an uploaded image.
 *
 * Re-encoding through sharp is deliberate: it strips EXIF (including GPS),
 * discards any trailing polyglot payload, and guarantees the stored bytes are
 * a real image rather than something that merely starts like one.
 */
export async function processUpload(
  file: File,
  kind: UploadKind,
  ownerId: string,
): Promise<StoredFile> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new AppError('FILE_TOO_LARGE', 'Image must be 5 MB or smaller');
  }
  if (file.size === 0) {
    throw new AppError('BAD_REQUEST', 'Empty file');
  }

  const input = Buffer.from(await file.arrayBuffer());
  if (input.length > MAX_UPLOAD_BYTES) {
    throw new AppError('FILE_TOO_LARGE', 'Image must be 5 MB or smaller');
  }

  const detected = detectImageType(input);
  if (!detected) {
    throw new AppError('UNSUPPORTED_FILE_TYPE', 'Only JPEG, PNG and WebP images are allowed');
  }

  const settings = OUTPUT[kind];
  let output: Buffer;

  try {
    const image = sharp(input, { failOn: 'error', limitInputPixels: MAX_DIMENSION ** 2 });
    const metadata = await image.metadata();

    if (!metadata.width || !metadata.height) {
      throw new AppError('UNSUPPORTED_FILE_TYPE', 'Could not read image dimensions');
    }
    if (metadata.width > MAX_DIMENSION || metadata.height > MAX_DIMENSION) {
      throw new AppError('FILE_TOO_LARGE', `Image must be at most ${MAX_DIMENSION}px on each side`);
    }

    output = await image
      .rotate() // apply EXIF orientation before the metadata is dropped
      .resize({
        width: settings.width,
        height: settings.height,
        fit: 'cover',
        withoutEnlargement: true,
      })
      .webp({ quality: settings.quality })
      .toBuffer();
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('UNSUPPORTED_FILE_TYPE', 'That file is not a valid image');
  }

  // Random name: the original filename is attacker-controlled and the key must
  // not be guessable from the duel or user it belongs to.
  const key = `${kind}/${ownerId.slice(0, 8)}/${randomUUID()}.webp`;
  return getStorage().put(key, output, 'image/webp');
}

export async function deleteUpload(key: string | null | undefined): Promise<void> {
  if (!key) return;
  await getStorage().delete(key);
}
