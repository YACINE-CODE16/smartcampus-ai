import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { ROLE_HOME, ROLE_LABELS, type DemoAccount } from '@smartcampus/shared';
import { ApiRequestError, api } from '../../lib/api';
import { useAuth } from '../../lib/auth';

/** US-01 : connexion avec le compte école (SSO simulé par les comptes de démo). */
export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [demo, setDemo] = useState<{ accounts: DemoAccount[]; password: string | null }>({ accounts: [], password: null });

  useEffect(() => {
    api.get<typeof demo>('/auth/demo-accounts').then(setDemo).catch(() => undefined);
  }, []);

  if (user) return <Navigate to={ROLE_HOME[user.role]} replace />;

  async function signIn(e: string, p: string) {
    setBusy(true);
    setError(null);
    try {
      const u = await login(e, p);
      navigate(ROLE_HOME[u.role], { replace: true });
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Connexion impossible.');
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    void signIn(email, password);
  }

  return (
    <div className="login">
      <section className="card login__card">
        <h1 className="login__title">Connexion école</h1>
        <p className="muted">Utilisez votre compte école ESIEA. Aucune création de compte n'est nécessaire.</p>

        <form onSubmit={onSubmit} noValidate className="form">
          <div className="field">
            <label htmlFor="email">Email école</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              placeholder="prenom.nom@esiea.fr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">Mot de passe</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && (
            <p className="alert alert--error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
            {busy ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>
        <p className="hint">SSO école simulé pour la démonstration.</p>
      </section>

      {demo.accounts.length > 0 && demo.password && (
        <section className="card login__demo" aria-labelledby="demo-title">
          <h2 id="demo-title">Comptes de démonstration</h2>
          <ul className="demo-list">
            {demo.accounts.map((a) => (
              <li key={a.email}>
                <button type="button" className="demo-account" disabled={busy} onClick={() => void signIn(a.email, demo.password!)}>
                  <span className={`role-chip role-chip--${a.role.toLowerCase()}`}>{ROLE_LABELS[a.role]}</span>
                  <span className="demo-account__name">{a.name}</span>
                  <span className="demo-account__email">{a.email}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
