import { Link, NavLink, Outlet, useNavigate } from 'react-router';
import { LANGS, ROLE_LABELS, type Bilingual, type Role } from '@smartcampus/shared';
import { AlertsBanner } from '../components/AlertsBanner';
import { NotificationBell } from '../components/NotificationBell';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';

const NAV: Record<Role, { to: string; label: Bilingual; end?: boolean }[]> = {
  STUDENT: [
    { to: '/etudiant', label: { fr: 'Mes signalements', en: 'My reports' }, end: true },
    { to: '/etudiant/signaler', label: { fr: 'Signaler', en: 'Report' } },
    { to: '/etudiant/assistant', label: { fr: 'Assistant IA', en: 'AI assistant' } },
  ],
  AGENT: [{ to: '/agent', label: { fr: 'Tickets', en: 'Tickets' }, end: true }],
  ADMIN: [
    { to: '/admin', label: { fr: 'Tableau de bord', en: 'Dashboard' }, end: true },
    { to: '/admin/tickets', label: { fr: 'Tickets', en: 'Tickets' } },
    { to: '/admin/reglages', label: { fr: 'Délais cibles', en: 'Target times' } },
    { to: '/admin/base-documentaire', label: { fr: 'Base documentaire', en: 'Knowledge base' } },
    { to: '/admin/utilisateurs', label: { fr: 'Utilisateurs', en: 'Users' } },
    { to: '/admin/audit', label: { fr: 'Audit', en: 'Audit' } },
  ],
};

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
          className={`lang__btn ${lang === l ? 'lang__btn--on' : ''}`}
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

export function AppLayout() {
  const { user, logout } = useAuth();
  const { t, label } = useI18n();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/connexion', { replace: true });
  }

  return (
    <div className="shell">
      <a href="#contenu" className="skip-link">
        {t('Aller au contenu', 'Skip to content')}
      </a>
      <header className="topbar">
        <Link to="/" className="brand" aria-label={t('SmartCampus AI, accueil', 'SmartCampus AI, home')}>
          <img src="/favicon.svg" alt="" width={28} height={28} />
          <span>SmartCampus</span>
        </Link>
        <div className="topbar__user">
          <LangSwitch />
          {user && (
            <>
              <NotificationBell role={user.role} />
              <span className="topbar__name">
                {user.name} <span className="topbar__role">· {label(ROLE_LABELS[user.role])}</span>
              </span>
              <button type="button" className="btn btn--ghost btn--sm" onClick={handleLogout}>
                {t('Déconnexion', 'Sign out')}
              </button>
            </>
          )}
        </div>
      </header>
      {user && (
        <nav className="tabs" aria-label={t('Navigation principale', 'Main navigation')}>
          {NAV[user.role].map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className="tabs__link">
              {label(item.label)}
            </NavLink>
          ))}
        </nav>
      )}
      {user?.role === 'ADMIN' && <AlertsBanner />}
      <main className="content" id="contenu" tabIndex={-1}>
        <Outlet />
      </main>
      <footer className="footer">
        <Link to="/mentions">{t('Mentions et données personnelles', 'Legal notice and personal data')}</Link>
      </footer>
    </div>
  );
}
