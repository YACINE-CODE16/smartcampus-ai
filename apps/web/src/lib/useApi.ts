import { useCallback, useEffect, useState } from 'react';
import { ApiRequestError, api } from './api';

interface ApiResource<T> {
  data: T | null;
  error: ApiRequestError | null;
  loading: boolean;
  reload(): void;
}

/** Charge une ressource GET et expose son état. `path = null` désactive le chargement. */
export function useApi<T>(path: string | null): ApiResource<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiRequestError | null>(null);
  const [loading, setLoading] = useState(path !== null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (path === null) return;
    let cancelled = false;
    // Synchronisation avec une ressource externe (l'API) : l'indicateur de chargement doit suivre la requête.
    // oxlint-disable-next-line react/set-state-in-effect
    setLoading(true);
    api
      .get<T>(path)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setError(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof ApiRequestError ? e : new ApiRequestError(0, 'ERROR', 'Erreur inattendue.'));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [path, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { data, error, loading, reload };
}
