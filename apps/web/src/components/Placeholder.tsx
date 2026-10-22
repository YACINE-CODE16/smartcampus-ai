import { useI18n } from '../lib/i18n';

/** Écran provisoire pour une fonctionnalité d'un bloc ultérieur. */
export function Placeholder({ title, story }: { title: string; story: string }) {
  const { t } = useI18n();
  return (
    <section className="empty">
      <h1>{title}</h1>
      <p className="muted">
        {t('Bientôt disponible', 'Coming soon')} ({story}).
      </p>
    </section>
  );
}
