import { DeleteObjectCommand, GetObjectCommand, NoSuchKey, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { Readable } from 'node:stream';
import { FILE_KEY_PATTERN, type FileStorage, type StoredFile } from '../ports/file-storage';

/**
 * Photos dans un bucket S3 privé (production).
 * Identifiants : chaîne par défaut du SDK (rôle IAM de l'instance EC2 en production).
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
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType, ServerSideEncryption: 'AES256' }),
    );
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
}
