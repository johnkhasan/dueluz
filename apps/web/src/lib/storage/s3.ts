import { env } from '../env';
import type { StorageAdapter, StoredFile } from './types';

type S3Module = typeof import('@aws-sdk/client-s3');

/**
 * Production driver. Works with S3, Cloudflare R2 and MinIO — anything that
 * speaks the S3 API. The SDK is imported lazily so the local driver never pays
 * for it.
 */
export class S3Storage implements StorageAdapter {
  readonly name = 's3' as const;
  private client: InstanceType<S3Module['S3Client']> | null = null;
  private sdk: S3Module | null = null;

  private async connect() {
    if (this.client && this.sdk) return { client: this.client, sdk: this.sdk };
    const sdk = (await import('@aws-sdk/client-s3')) as S3Module;
    const client = new sdk.S3Client({
      region: env.S3_REGION,
      ...(env.S3_ENDPOINT ? { endpoint: env.S3_ENDPOINT } : {}),
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID ?? '',
        secretAccessKey: env.S3_SECRET_ACCESS_KEY ?? '',
      },
    });
    this.client = client;
    this.sdk = sdk;
    return { client, sdk };
  }

  async put(key: string, body: Buffer, contentType: string): Promise<StoredFile> {
    const { client, sdk } = await this.connect();
    await client.send(
      new sdk.PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
    return { key, url: this.url(key) };
  }

  async delete(key: string): Promise<void> {
    const { client, sdk } = await this.connect();
    await client.send(new sdk.DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
  }

  url(key: string): string {
    const base = (env.S3_PUBLIC_URL ?? `${env.S3_ENDPOINT}/${env.S3_BUCKET}`).replace(/\/$/, '');
    return `${base}/${key}`;
  }
}
