export type StoredFile = {
  /** Driver-specific key, stored alongside the entity so the file can be deleted. */
  key: string;
  /** Publicly reachable URL. */
  url: string;
};

export interface StorageAdapter {
  readonly name: 'local' | 's3';
  put(key: string, body: Buffer, contentType: string): Promise<StoredFile>;
  delete(key: string): Promise<void>;
  url(key: string): string;
}
