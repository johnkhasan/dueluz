import { env } from '../env';
import { LocalStorage } from './local';
import { S3Storage } from './s3';
import type { StorageAdapter } from './types';

export type { StorageAdapter, StoredFile } from './types';

let adapter: StorageAdapter | null = null;

/**
 * The active storage driver, chosen by STORAGE_DRIVER. Swapping local disk for
 * S3/R2 in production is a config change, not a code change.
 */
export function getStorage(): StorageAdapter {
  adapter ??= env.STORAGE_DRIVER === 's3' ? new S3Storage() : new LocalStorage();
  return adapter;
}
