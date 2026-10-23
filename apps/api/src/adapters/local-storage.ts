import { createHmac, timingSafeEqual } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, open, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { CONTENT_TYPES, FILE_KEY_PATTERN, type FileStorage, type StoredFile, type UploadTarget } from '../ports/file-storage';

interface TokenPayload {
  key: string;
  purpose: 'upload' | 'read';
  exp: number;
  contentType?: string;
  maxBytes?: number;
}

/**
 * Fichiers sur le disque local (développement). Imite les URL présignées S3 :
 * l'API délivre un jeton signé (HMAC) à durée courte, vérifié par les routes `/api/files/local/*`.
 */
export class LocalFileStorage implements FileStorage {
  readonly name = 'local';
  private readonly root: string;

  constructor(
    dir: string,
    private readonly secret: string,
  ) {
    this.root = resolve(dir);
  }

  private path(key: string): string {
    if (!FILE_KEY_PATTERN.test(key)) throw new Error(`Clé de fichier invalide : ${key}`);
    return join(this.root, key);
  }

  private sign(payload: TokenPayload): string {
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const mac = createHmac('sha256', this.secret).update(body).digest('base64url');
    return `${body}.${mac}`;
  }

  /** Renvoie le contenu du jeton s'il est authentique, non expiré et prévu pour cet usage. */
  verify(token: string, purpose: TokenPayload['purpose']): TokenPayload | null {
    const [body, mac] = token.split('.');
    if (!body || !mac) return null;
    const expected = createHmac('sha256', this.secret).update(body).digest();
    const given = Buffer.from(mac, 'base64url');
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as TokenPayload;
    if (payload.purpose !== purpose || payload.exp < Date.now() || !FILE_KEY_PATTERN.test(payload.key)) return null;
    return payload;
  }

  async put(key: string, body: Buffer): Promise<void> {
    const path = this.path(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body);
  }

  async get(key: string): Promise<StoredFile | null> {
    const path = this.path(key);
    try {
      await stat(path);
    } catch {
      return null;
    }
    const ext = key.split('.').pop() ?? '';
    return { body: createReadStream(path), contentType: CONTENT_TYPES[ext] ?? 'application/octet-stream' };
  }

  async delete(key: string): Promise<void> {
    await rm(this.path(key), { force: true });
  }

  async createUpload(key: string, contentType: string, maxBytes: number, ttlSeconds: number): Promise<UploadTarget> {
    const exp = Date.now() + ttlSeconds * 1000;
    return {
      key,
      url: '/api/files/local/upload',
      fields: { token: this.sign({ key, purpose: 'upload', exp, contentType, maxBytes }) },
      maxBytes,
      expiresAt: new Date(exp).toISOString(),
    };
  }

  async readUrl(key: string, ttlSeconds: number): Promise<string> {
    return `/api/files/local/download?token=${this.sign({ key, purpose: 'read', exp: Date.now() + ttlSeconds * 1000 })}`;
  }

  async readHead(key: string, bytes: number): Promise<{ size: number; head: Buffer } | null> {
    const path = this.path(key);
    try {
      const { size } = await stat(path);
      const fh = await open(path, 'r');
      try {
        const head = Buffer.alloc(Math.min(bytes, size));
        await fh.read(head, 0, head.length, 0);
        return { size, head };
      } finally {
        await fh.close();
      }
    } catch {
      return null;
    }
  }
}
