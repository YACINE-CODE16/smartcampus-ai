import type { Request } from 'express';
import type { Lang } from '@smartcampus/shared';

/** US-38 : langue de la réponse — en-tête `Accept-Language` envoyé par le front, sinon français. */
export function requestLang(req: Request): Lang {
  const header = req.headers['accept-language'];
  return typeof header === 'string' && header.trim().toLowerCase().startsWith('en') ? 'en' : 'fr';
}
