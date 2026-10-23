import { createHash, randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import pg from 'pg';

/**
 * Équivalent de `prisma migrate deploy` pour la Lambda Migrate : le moteur de migration de Prisma est un
 * binaire natif (+ CLI de 40 Mo) inutile ici. Mêmes fichiers `prisma/migrations/<nom>/migration.sql`,
 * même table `_prisma_migrations` et même empreinte SHA-256 : `prisma migrate status` reste cohérent.
 */
export async function applyMigrations(databaseUrl: string, dir: string): Promise<string[]> {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      "id" VARCHAR(36) PRIMARY KEY NOT NULL,
      "checksum" VARCHAR(64) NOT NULL,
      "finished_at" TIMESTAMPTZ,
      "migration_name" VARCHAR(255) NOT NULL,
      "logs" TEXT,
      "rolled_back_at" TIMESTAMPTZ,
      "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "applied_steps_count" INTEGER NOT NULL DEFAULT 0
    )`);
    // Un seul déploiement de migrations à la fois.
    await client.query('SELECT pg_advisory_lock(72707369)');
    const done = await client.query<{ migration_name: string }>(
      'SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL',
    );
    const applied = new Set(done.rows.map((r) => r.migration_name));
    const names = (await readdir(dir, { withFileTypes: true }))
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();

    const ran: string[] = [];
    for (const name of names) {
      if (applied.has(name)) continue;
      const sql = await readFile(join(dir, name, 'migration.sql'), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const id = randomUUID();
      await client.query('BEGIN');
      try {
        await client.query('INSERT INTO "_prisma_migrations" (id, checksum, migration_name) VALUES ($1, $2, $3)', [id, checksum, name]);
        await client.query(sql);
        await client.query('UPDATE "_prisma_migrations" SET finished_at = now(), applied_steps_count = 1 WHERE id = $1', [id]);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${name} en échec : ${(err as Error).message}`);
      }
      ran.push(name);
    }
    return ran;
  } finally {
    await client.query('SELECT pg_advisory_unlock(72707369)').catch(() => undefined);
    await client.end();
  }
}
