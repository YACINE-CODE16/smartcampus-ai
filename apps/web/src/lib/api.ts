import type { ApiError } from '@smartcampus/shared';

/** Erreur renvoyée par l'API, avec le code HTTP et les erreurs par champ éventuelles. */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: Record<string, string>;

  constructor(status: number, code: string, message: string, fields: Record<string, string> = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

/** Langue des messages renvoyés par l'API (US-38), tenue à jour par `I18nProvider`. */
let requestLang = 'fr';
export function setRequestLang(lang: string) {
  requestLang = lang;
}

/** Appelé quand une session expire (401) pour renvoyer vers la connexion. */
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const isForm = body instanceof FormData;
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: { 'accept-language': requestLang, ...(body !== undefined && !isForm ? { 'content-type': 'application/json' } : {}) },
      body: isForm ? body : body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiRequestError(
      0,
      'NETWORK',
      requestLang === 'en' ? 'Server unreachable. Check your connection.' : 'Serveur injoignable. Vérifiez votre connexion.',
    );
  }

  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) {
    const err = (data ?? {}) as Partial<ApiError>;
    if (res.status === 401 && path !== '/auth/login' && path !== '/auth/me') onUnauthorized?.();
    const fallback = requestLang === 'en' ? 'Something went wrong.' : 'Une erreur est survenue.';
    throw new ApiRequestError(res.status, err.error ?? 'ERROR', err.message ?? fallback, err.fields);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};

/** Construit une query string en ignorant les valeurs vides. */
export function query(params: Record<string, string | number | boolean | undefined | null>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '' && v !== false) q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : '';
}
