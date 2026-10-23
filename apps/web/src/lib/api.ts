import type { ApiError, AuthTokens } from '@smartcampus/shared';

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

/**
 * Jetons Cognito (déploiement AWS) : gardés le temps de l'onglet et envoyés en `Authorization: Bearer`,
 * vérifiés par API Gateway. En local il n'y en a pas : la session est un cookie httpOnly.
 */
const TOKENS_KEY = 'sc_tokens';
let tokens: AuthTokens | null = (() => {
  try {
    return JSON.parse(sessionStorage.getItem(TOKENS_KEY) ?? 'null') as AuthTokens | null;
  } catch {
    return null;
  }
})();
export function setTokens(next: AuthTokens | null | undefined) {
  tokens = next ?? null;
  try {
    if (tokens) sessionStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
    else sessionStorage.removeItem(TOKENS_KEY);
  } catch {
    // stockage indisponible (navigation privée) : la session vit en mémoire
  }
}

/** Un seul rafraîchissement à la fois, partagé par les requêtes qui reçoivent un 401. */
let refreshing: Promise<boolean> | null = null;
function refreshTokens(): Promise<boolean> {
  const refreshToken = tokens?.refreshToken;
  if (!refreshToken) return Promise.resolve(false);
  refreshing ??= fetch('/api/auth/refresh', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refreshToken }) })
    .then(async (res) => {
      if (!res.ok) return false;
      setTokens((await res.json()) as AuthTokens);
      return true;
    })
    .catch(() => false)
    .finally(() => (refreshing = null));
  return refreshing;
}

const networkError = () =>
  new ApiRequestError(0, 'NETWORK', requestLang === 'en' ? 'Server unreachable. Check your connection.' : 'Serveur injoignable. Vérifiez votre connexion.');

/** `fetch` vers l'API avec langue et jeton ; un jeton expiré est rafraîchi une fois puis la requête rejouée. */
async function send(path: string, init: RequestInit = {}): Promise<Response> {
  const go = () => {
    const headers = new Headers(init.headers);
    headers.set('accept-language', requestLang);
    if (tokens) headers.set('authorization', `Bearer ${tokens.idToken}`);
    return fetch(`/api${path}`, { ...init, headers, credentials: 'same-origin' });
  };
  let res: Response;
  try {
    res = await go();
    if (res.status === 401 && tokens && !path.startsWith('/auth/login') && (await refreshTokens())) res = await go();
  } catch {
    throw networkError();
  }
  return res;
}

async function failure(res: Response, path: string): Promise<ApiRequestError> {
  const err = ((await res.json().catch(() => null)) ?? {}) as Partial<ApiError>;
  if (res.status === 401 && path !== '/auth/login' && path !== '/auth/me') onUnauthorized?.();
  const fallback = requestLang === 'en' ? 'Something went wrong.' : 'Une erreur est survenue.';
  return new ApiRequestError(res.status, err.error ?? 'ERROR', err.message ?? fallback, err.fields);
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const isForm = body instanceof FormData;
  const res = await send(path, {
    method,
    headers: body !== undefined && !isForm ? { 'content-type': 'application/json' } : {},
    body: isForm ? body : body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw await failure(res, path);
  if (res.status === 204) return undefined as T;
  return (await res.json().catch(() => null)) as T;
}

/** Téléchargement authentifié (exports CSV) : un simple lien ne porterait pas le jeton sur AWS. */
export async function download(path: string, fallbackName: string): Promise<void> {
  const res = await send(path);
  if (!res.ok) throw await failure(res, path);
  const name = /filename="?([^";]+)"?/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? fallbackName;
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** US-04 : envoi direct d'un fichier au stockage (S3 présigné sur AWS), puis renvoi de sa clé. */
export async function uploadFile(file: File): Promise<string> {
  const target = await request<{ key: string; url: string; fields: Record<string, string> }>('POST', '/files/uploads', {
    contentType: file.type,
    size: file.size,
  });
  const form = new FormData();
  for (const [k, v] of Object.entries(target.fields)) form.set(k, v);
  form.set('file', file); // S3 exige le fichier en dernier champ
  let res: Response;
  try {
    res = await fetch(target.url, { method: 'POST', body: form });
  } catch {
    throw networkError();
  }
  if (!res.ok) {
    const msg = requestLang === 'en' ? 'The file could not be sent.' : 'Le fichier n’a pas pu être envoyé.';
    throw new ApiRequestError(400, 'VALIDATION', msg, { photo: msg });
  }
  return target.key;
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
