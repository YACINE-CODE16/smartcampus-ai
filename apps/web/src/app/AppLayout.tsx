import {
  BookOpen,
  Bot,
  ClipboardList,
  Clock3,
  FileClock,
  Inbox,
  LayoutDashboard,
  LogOut,
  PlusCircle,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router';
import { LANGS, ROLE_LABELS, type Bilingual, type Role } from '@smartcampus/shared';
import { AlertsBanner } from '../components/AlertsBanner';
import { NotificationBell } from '../components/NotificationBell';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';

const NAV: Record<Role, { to: string; label: Bilingual; icon: LucideIcon; end?: boolean }[]> = {
  STUDENT: [
    { to: '/etudiant', label: { fr: 'Mes signalements', en: 'My reports' }, icon: ClipboardList, end: true },
    { to: '/etudiant/signaler', label: { fr: 'Signaler', en: 'Report' }, icon: PlusCircle },
    { to: '/etudiant/assistant', label: { fr: 'Assistant', en: 'Assistant' }, icon: Bot },
  ],
  AGENT: [{ to: '/agent', label: { fr: 'Tickets', en: 'Tickets' }, icon: Inbox, end: true }],
  ADMIN: [
    { to: '/admin', label: { fr: 'Tableau de bord', en: 'Dashboard' }, icon: LayoutDashboard, end: true },
    { to: '/admin/tickets', label: { fr: 'Tickets', en: 'Tickets' }, icon: Inbox },
    { to: '/admin/reglages', label: { fr: 'Délais cibles', en: 'Target times' }, icon: Clock3 },
    { to: '/admin/base-documentaire', label: { fr: 'Base documentaire', en: 'Knowledge base' }, icon: BookOpen },
    { to: '/admin/utilisateurs', label: { fr: 'Utilisateurs', en: 'Users' }, icon: Users },
    { to: '/admin/audit', label: { fr: 'Journal d’audit', en: 'Audit log' }, icon: FileClock },
  ],
};

/** Marque : une porte de salle vue de face, en écho à la plaque de lieu. */
function Logo() {
  return (
    <svg className="logo" viewBox="0 0 28 28" width="28" height="28" aria-hidden="true">
      <rect width="28" height="28" rx="6" fill="currentColor" />
      <path d="M9 22V7.5A1.5 1.5 0 0 1 10.5 6h7A1.5 1.5 0 0 1 19 7.5V22" fill="none" stroke="var(--surface)" strokeWidth="2" strokeLinejoin="round" />
      <path d="M6.5 22h15" stroke="var(--surface)" strokeWidth="2" strokeLinecap="round" />
      <circle cx="16" cy="14.5" r="1.4" fill="var(--safety)" />
    </svg>
  );
}

/** US-38 : sélecteur de langue, disponible sur toutes les pages. */
function LangSwitch() {
  const { lang, setLang, t } = useI18n();
  const { user } = useAuth();
  return (
    <div className="lang" role="group" aria-label={t('Langue', 'Language')}>
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          className="lang__btn"
          aria-pressed={lang === l}
          onClick={() => {
            setLang(l);
            // La langue du profil sert aux emails (US-10).
            if (user) void api.patch('/auth/me', { locale: l }).catch(() => undefined);
          }}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

/**
 * Squelette de l'application : barre latérale sur ordinateur (≥ 960 px),
 * barre supérieure + onglets défilants sur mobile (DESIGN.md, mise en page).
 */
export function AppLayout() {
  const { user, logout } = useAuth();
  const { t, label } = useI18n();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/connexion', { replace: true });
  }

  return (
    <div className={`shell ${user ? 'shell--app' : 'shell--public'}`}>
      <a href="#contenu" className="skip-link">
        {t('Aller au contenu', 'Skip to content')}
      </a>

      <header className="topbar">
        <Link to="/" className="brand" aria-label={t('SmartCampus, accueil', 'SmartCampus, home')}>
          <Logo />
          <span className="brand__name">SmartCampus</span>
        </Link>
        <div className="topbar__tools">
          {user && <NotificationBell role={user.role} />}
          <LangSwitch />
          {user && (
            <button type="button" className="icon-btn topbar__logout" onClick={handleLogout} aria-label={t('Se déconnecter', 'Sign out')}>
              <LogOut size={18} strokeWidth={1.75} aria-hidden="true" />
            </button>
          )}
        </div>
      </header>

      {user && (
        <aside className="sidebar">
          <nav aria-label={t('Navigation principale', 'Main navigation')}>
            <ul className="nav">
              {NAV[user.role].map(({ to, label: l, icon: Icon, end }) => (
                <li key={to}>
                  <NavLink to={to} end={end} className="nav__link">
                    <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
                    <span>{label(l)}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <div className="account">
            <p className="account__name">{user.name}</p>
            <p className="account__role">{label(ROLE_LABELS[user.role])}</p>
            <button type="button" className="btn btn--quiet btn--sm" onClick={handleLogout}>
              <LogOut size={16} strokeWidth={1.75} aria-hidden="true" />
              {t('Se déconnecter', 'Sign out')}
            </button>
          </div>
        </aside>
      )}

      <div className="main">
        {user?.role === 'ADMIN' && <AlertsBanner />}
        <main className="content" id="contenu" tabIndex={-1}>
          <Outlet />
        </main>
        <footer className="footer">
          <Link to="/mentions">{t('Mentions et données personnelles', 'Legal notice and personal data')}</Link>
        </footer>
      </div>
    </div>
  );
}
