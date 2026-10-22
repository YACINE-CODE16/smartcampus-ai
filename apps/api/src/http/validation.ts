import type { z } from 'zod';
import { ValidationError } from '../domain/errors';

/**
 * Valide une entrée ; en cas d'échec, lève une `ValidationError` avec un message par champ.
 * Les messages des schémas sont écrits avec `bi(fr, en)` et localisés à la réponse.
 */
export function parseBody<S extends z.ZodType>(schema: S, input: unknown): z.infer<S> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const fields: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || '_';
    fields[key] ??= issue.message;
  }
  throw new ValidationError(undefined, fields);
}
