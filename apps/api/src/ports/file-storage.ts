import type { Readable } from 'node:stream';

export interface StoredFile {
  body: Readable;
  contentType: string;
}

/**
 * Stockage des photos (US-04).
 * - `local` : dossier `UPLOAD_DIR` sur le disque.
 * - `s3` : bucket `S3_BUCKET` (chiffrement SSE-S3).
 * Les photos ne sont jamais publiques : l'API les sert après contrôle d'accès.
 */
export interface FileStorage {
  readonly name: string;
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  /** `null` si le fichier n'existe pas. */
  get(key: string): Promise<StoredFile | null>;
  delete(key: string): Promise<void>;
}

/** Clés acceptées : `incidents/<uuid>.<jpg|png|pdf>` (empêche toute traversée de chemin). */
export const FILE_KEY_PATTERN = /^incidents\/[0-9a-f-]{36}\.(jpg|png|pdf)$/;

export const CONTENT_TYPES: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', pdf: 'application/pdf' };
