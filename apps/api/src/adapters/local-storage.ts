import { createReadStream } from 'node:fs';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { FILE_KEY_PATTERN, type FileStorage, type StoredFile } from '../ports/file-storage';

const CONTENT_TYPES: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png' };

/** Photos sur le disque local (développement). */
export class LocalFileStorage implements FileStorage {
  readonly name = 'local';
  private readonly root: string;

  constructor(dir: string) {
    this.root = resolve(dir);
  }

  private path(key: string): string {
    if (!FILE_KEY_PATTERN.test(key)) throw new Error(`Clé de fichier invalide : ${key}`);
    return join(this.root, key);
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
}
