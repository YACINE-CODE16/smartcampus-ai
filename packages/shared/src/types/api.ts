/** Contrats HTTP partagés entre l'API et le front. */

export interface HealthResponse {
  status: 'ok' | 'degraded';
  version: string;
  /** Jeu d'adapters actif : `local` aujourd'hui, `aws` après la phase 9. */
  mode: 'local' | 'aws';
  database: 'ok' | 'error';
  /** Implémentation active de chaque port (ex. `prisma-sqlite`). */
  adapters: Record<string, string>;
}

export interface ApiError {
  error: string;
  message: string;
}
