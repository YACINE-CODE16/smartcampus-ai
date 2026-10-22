import { Link, NavLink, Outlet, useNavigate } from 'react-router';
import { ROLE_LABELS, type Role } from '@smartcampus/shared';
import { useAuth } from '../lib/auth';

const NAV: Record<Role, { to: string; label: string; end?: boolean }[]> = {
  STUDENT: [
    { to: '/etudiant', label: 'Mes signalements', end: true },
    { to: '/etudiant/signaler', label: 'Signaler' },
    { to: '/etudiant/assistant', label: 'Assistant IA' },
  ],
  AGENT: [{ to: '/agent', label: 'Tickets', end: true }],
  ADMIN: [
    { to: '/admin', label: 'Tableau de bord', end: true },
    { to: '/admin/tickets', label: 'Tickets' },
  ],
};

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/connexion', { replace: true });
  }

  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/" className="brand" aria-label="SmartCampus AI, accueil">
          <img src="/favicon.svg" alt="" width={28} height={28} />
          <span>SmartCampus</span>
        </Link>
        {user && (
          <div className="topbar__user">
            <span className="topbar__name">
              {user.name} <span className="topbar__role">· {ROLE_LABELS[user.role]}</span>
            </span>
            <button type="button" className="btn btn--ghost btn--sm" onClick={handleLogout}>
              Déconnexion
            </button>
          </div>
        )}
      </header>
      {user && (
        <nav className="tabs" aria-label="Navigation principale">
          {NAV[user.role].map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className="tabs__link">
              {item.label}
            </NavLink>
          ))}
        </nav>
      )}
      <main className="content">
        <Outlet />
      </main>
      <footer className="footer">
        <Link to="/mentions">Mentions et données personnelles</Link>
      </footer>
    </div>
  );
}
