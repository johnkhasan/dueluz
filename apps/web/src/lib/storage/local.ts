import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { env } from '../env';
import type { StorageAdapter, StoredFile } from './types';

/**
 * Development / single-server driver. Writes into the Next.js `public`
 * directory so files are served statically with no extra infrastructure.
 */
export class LocalStorage implements StorageAdapter {
  readonly name = 'local' as const;
  private readonly root = resolve(process.cwd(), '..', '..', env.LOCAL_STORAGE_DIR);
  private readonly publicPath = env.LOCAL_STORAGE_PUBLIC_PATH.replace(/\/$/, '');

  /** Rejects keys that would escape the storage root. */
  private safePath(key: string): string {
    const target = resolve(this.root, key);
    if (target !== this.root && !target.startsWith(this.root + sep)) {
      throw new Error(`Refusing to write outside the storage root: ${key}`);
    }
    return target;
  }

  async put(key: string, body: Buffer, _contentType: string): Promise<StoredFile> {
    void _contentType;
    const target = this.safePath(key);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, body);
    return { key, url: this.url(key) };
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(this.safePath(key));
    } catch {
      // Deleting an already-missing file is not an error.
    }
  }

  url(key: string): string {
    return `${this.publicPath}/${key}`.replace(/\/+/g, '/');
  }
}
