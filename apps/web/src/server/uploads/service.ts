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
/**
 * Validates and normalises image bytes, then stores them.
 *
 * Re-encoding through sharp is deliberate: it strips EXIF (including GPS),
 * discards any trailing polyglot payload, and guarantees the stored bytes are
 * a real image rather than something that merely starts like one.
 *
 * Shared by browser uploads and by mirrored remote images, so both go through
 * exactly the same checks.
 */
export async function storeImage(
  input: Buffer,
  kind: UploadKind,
  ownerId: string,
): Promise<StoredFile> {
  if (input.length === 0) {
    throw new AppError('BAD_REQUEST', 'Empty file');
  }
  if (input.length > MAX_UPLOAD_BYTES) {
    throw new AppError('FILE_TOO_LARGE', 'Image must be 5 MB or smaller');
  }

  if (!detectImageType(input)) {
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

/** Validates and stores a browser upload. */
export async function processUpload(
  file: File,
  kind: UploadKind,
  ownerId: string,
): Promise<StoredFile> {
  // Checked before reading the body so an oversized upload is refused early.
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new AppError('FILE_TOO_LARGE', 'Image must be 5 MB or smaller');
  }
  return storeImage(Buffer.from(await file.arrayBuffer()), kind, ownerId);
}

/**
 * Copies a remote image into our own storage.
 *
 * Telegram's `photo_url` points at a t.me CDN path that expires — a profile
 * picture that renders today is a 404 next week — and letting every visitor's
 * browser fetch it also tells Telegram who is reading which page. Mirroring the
 * bytes once at sign-in fixes both.
 *
 * Returns null on any failure: an avatar is a nicety, and sign-in must never
 * depend on a third party being reachable.
 */
export async function mirrorRemoteImage(
  url: string,
  kind: UploadKind,
  ownerId: string,
): Promise<StoredFile | null> {
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(5000),
      headers: { accept: 'image/*' },
    });
    if (!response.ok) return null;

    const declared = Number(response.headers.get('content-length') ?? 0);
    if (declared > MAX_UPLOAD_BYTES) return null;

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length === 0 || buffer.length > MAX_UPLOAD_BYTES) return null;

    // The remote server's Content-Type is no more trustworthy than a browser
    // upload's, so the bytes go through the same checks.
    return await storeImage(buffer, kind, ownerId);
  } catch {
    return null;
  }
}


export async function deleteUpload(key: string | null | undefined): Promise<void> {
  if (!key) return;
  await getStorage().delete(key);
}
