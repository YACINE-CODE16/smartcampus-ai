/** Cible d'envoi direct navigateur → stockage (identique pour le front en local et sur AWS). */
export interface UploadTarget {
  key: string;
  url: string;
  method: 'PUT';
  headers: Record<string, string>;
  expiresAt: string;
}

/**
 * Stockage des photos.
 * - local : disque (`UPLOAD_DIR`), URL signées HMAC servies par l'API.
 * - aws (phase 9) : S3, URL présignées.
 * Les clés suivent le schéma `incident-photos/{userId}/{uuid}.{ext}`.
 */
export interface FileStorage {
  readonly name: string;
  createUploadTarget(key: string, contentType: string, maxBytes: number): Promise<UploadTarget>;
  getDownloadUrl(key: string, ttlSeconds: number): Promise<string>;
  exists(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
}
