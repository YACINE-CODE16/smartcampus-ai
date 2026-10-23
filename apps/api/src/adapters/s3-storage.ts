import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, NoSuchKey, NotFound, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Readable } from 'node:stream';
import { CONTENT_TYPES, FILE_KEY_PATTERN, type FileStorage, type StoredFile, type UploadTarget } from '../ports/file-storage';

/**
 * Bucket S3 privé (production) : envoi direct par POST présigné limité en taille,
 * lecture par URL présignée à courte durée. Identifiants : rôle de la Lambda.
 */
export class S3FileStorage implements FileStorage {
  readonly name = 's3';
  private readonly client: S3Client;

  constructor(
    private readonly bucket: string,
    region: string,
  ) {
    this.client = new S3Client({ region });
  }

  private check(key: string) {
    if (!FILE_KEY_PATTERN.test(key)) throw new Error(`Clé de fichier invalide : ${key}`);
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    this.check(key);
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType, ServerSideEncryption: 'AES256' }));
  }

  async get(key: string): Promise<StoredFile | null> {
    this.check(key);
    try {
      const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      if (!res.Body) return null;
      return { body: res.Body as Readable, contentType: res.ContentType ?? 'application/octet-stream' };
    } catch (err) {
      if (err instanceof NoSuchKey) return null;
      throw err;
    }
  }

  async delete(key: string): Promise<void> {
    this.check(key);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async createUpload(key: string, contentType: string, maxBytes: number, ttlSeconds: number): Promise<UploadTarget> {
    this.check(key);
    const { url, fields } = await createPresignedPost(this.client, {
      Bucket: this.bucket,
      Key: key,
      Conditions: [
        ['content-length-range', 1, maxBytes],
        ['eq', '$Content-Type', contentType],
      ],
      Fields: { 'Content-Type': contentType, 'x-amz-server-side-encryption': 'AES256' },
      Expires: ttlSeconds,
    });
    return { key, url, fields, maxBytes, expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString() };
  }

  async readUrl(key: string, ttlSeconds: number): Promise<string> {
    this.check(key);
    const ext = key.split('.').pop() ?? '';
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key, ResponseContentType: CONTENT_TYPES[ext] }), {
      expiresIn: ttlSeconds,
    });
  }

  async readHead(key: string, bytes: number): Promise<{ size: number; head: Buffer } | null> {
    this.check(key);
    try {
      const meta = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key, Range: `bytes=0-${bytes - 1}` }));
      const head = Buffer.from((await res.Body?.transformToByteArray()) ?? []);
      return { size: meta.ContentLength ?? 0, head };
    } catch (err) {
      if (err instanceof NotFound || err instanceof NoSuchKey) return null;
      throw err;
    }
  }
}
