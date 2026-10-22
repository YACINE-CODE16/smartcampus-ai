import { useEffect, useState } from 'react';
import type { HealthResponse } from '@smartcampus/shared';

type ApiState = { kind: 'loading' } | { kind: 'ok'; health: HealthResponse } | { kind: 'error' };

/** Page d'accueil provisoire (phase 0) : vérifie que le front est relié à l'API. */
export default function App() {
  const [api, setApi] = useState<ApiState>({ kind: 'loading' });

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json() as Promise<HealthResponse>)
      .then((health) => setApi({ kind: 'ok', health }))
      .catch(() => setApi({ kind: 'error' }));
  }, []);

  return (
    <main className="home">
      <header className="home__brand">
        <img src="/favicon.svg" alt="" width={40} height={40} />
        <h1>SmartCampus AI</h1>
      </header>
      <p className="home__pitch">
        Signalez et suivez un incident du campus en moins de 2&nbsp;minutes.
      </p>
      <p className={`home__status home__status--${api.kind}`} role="status">
        {api.kind === 'loading' && 'Connexion à l’API…'}
        {api.kind === 'error' && 'API injoignable : lancez « npm run dev » à la racine.'}
        {api.kind === 'ok' &&
          `API connectée · base ${api.health.database === 'ok' ? 'OK' : 'en erreur'} · mode ${api.health.mode}`}
      </p>
      <p className="home__note">Connexion et espaces par rôle : phase 1.</p>
    </main>
  );
}
