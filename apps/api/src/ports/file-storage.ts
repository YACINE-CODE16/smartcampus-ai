import type { Readable } from 'node:stream';

export interface StoredFile {
  body: Readable;
  contentType: string;
}

/** Envoi direct navigateur → stockage : formulaire POST (champs + fichier). */
export interface UploadTarget {
  key: string;
  url: string;
  fields: Record<string, string>;
  maxBytes: number;
  expiresAt: string;
}

/**
 * Stockage des photos et documents (US-04).
 * - `local` : dossier `UPLOAD_DIR`, envois et lectures autorisés par jeton HMAC à durée courte.
 * - `s3` : bucket privé, URL présignées (POST limité en taille pour l'envoi, GET pour la lecture).
 * Le navigateur envoie le fichier directement (API Gateway limite les requêtes à 10 Mo) ;
 * l'API garde le contrôle d'accès en ne délivrant les URL qu'aux personnes autorisées.
 */
export interface FileStorage {
  readonly name: string;
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  /** `null` si le fichier n'existe pas. */
  get(key: string): Promise<StoredFile | null>;
  delete(key: string): Promise<void>;
  createUpload(key: string, contentType: string, maxBytes: number, ttlSeconds: number): Promise<UploadTarget>;
  readUrl(key: string, ttlSeconds: number): Promise<string>;
  /** Taille et premiers octets (vérification de la signature binaire après un envoi direct). */
  readHead(key: string, bytes: number): Promise<{ size: number; head: Buffer } | null>;
}

/** Clés acceptées : `incidents/<uuid>.<jpg|png|pdf>` (empêche toute traversée de chemin). */
export const FILE_KEY_PATTERN = /^incidents\/[0-9a-f-]{36}\.(jpg|png|pdf)$/;

export const CONTENT_TYPES: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', pdf: 'application/pdf' };
export const EXTENSIONS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'application/pdf': 'pdf' };
