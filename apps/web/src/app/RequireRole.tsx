import { Navigate, Outlet, useLocation } from 'react-router';
import { ROLE_HOME, type Role } from '@smartcampus/shared';
import { useAuth } from '../lib/auth';

/** Garde de route : non connecté → connexion ; mauvais rôle → son propre espace. */
export function RequireRole({ role }: { role: Role }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <p className="page-loading">Chargement…</p>;
  if (!user) return <Navigate to="/connexion" replace state={{ from: location.pathname }} />;
  if (user.role !== role) return <Navigate to={ROLE_HOME[user.role]} replace />;
  return <Outlet />;
}

/** `/` : redirige vers l'espace du rôle. */
export function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <p className="page-loading">Chargement…</p>;
  return <Navigate to={user ? ROLE_HOME[user.role] : '/connexion'} replace />;
}
