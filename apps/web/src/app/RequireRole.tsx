import { Navigate, Outlet, useLocation } from 'react-router';
import { ROLE_HOME, type Role } from '@smartcampus/shared';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';

function Loading() {
  const { t } = useI18n();
  return <p className="page-loading">{t('Chargement…', 'Loading…')}</p>;
}

/** Garde de route : non connecté → connexion ; mauvais rôle → son propre espace. */
export function RequireRole({ role }: { role: Role }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Loading />;
  if (!user) return <Navigate to="/connexion" replace state={{ from: location.pathname }} />;
  if (user.role !== role) return <Navigate to={ROLE_HOME[user.role]} replace />;
  return <Outlet />;
}

/** `/` : redirige vers l'espace du rôle. */
export function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  return <Navigate to={user ? ROLE_HOME[user.role] : '/connexion'} replace />;
}
