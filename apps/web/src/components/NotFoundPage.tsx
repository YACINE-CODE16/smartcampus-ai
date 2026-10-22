import { Link } from 'react-router';
import { useI18n } from '../lib/i18n';

export function NotFoundPage() {
  const { t } = useI18n();
  return (
    <section className="empty">
      <h1>{t('Page introuvable', 'Page not found')}</h1>
      <p className="muted">{t('Cette adresse ne correspond à aucune page.', 'This address does not match any page.')}</p>
      <Link to="/" className="btn btn--primary">
        {t('Retour à l’accueil', 'Back to home')}
      </Link>
    </section>
  );
}
