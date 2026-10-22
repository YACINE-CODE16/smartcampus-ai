import { useState } from 'react';
import { Link } from 'react-router';
import type { AlertsResponse } from '@smartcampus/shared';
import { useI18n } from '../lib/i18n';
import { useLive } from '../lib/live';
import { useApi } from '../lib/useApi';

/** R3 + US-18 : alertes admin (tickets critiques ouverts, tickets en retard), mises à jour en temps réel. */
export function AlertsBanner() {
  const { t } = useI18n();
  const { data, reload } = useApi<AlertsResponse>('/admin/alerts');
  const [flash, setFlash] = useState<string | null>(null);

  useLive((e) => {
    if (e.type === 'alert') {
      setFlash(e.kind === 'critical' ? t('Nouveau ticket critique !', 'New critical ticket!') : t('Un ticket a dépassé son délai cible.', 'A ticket is overdue.'));
      reload();
    } else if (e.type === 'incident.changed') {
      reload();
    }
  });

  if (!data || (data.critical.length === 0 && data.late.length === 0)) return null;
  return (
    <div className="alerts" role="status" aria-live="polite">
      {flash && (
        <p className="alerts__flash">
          🔔 {flash}{' '}
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setFlash(null)} aria-label={t('Fermer', 'Dismiss')}>
            ✕
          </button>
        </p>
      )}
      <div className="alerts__items">
        {data.critical.length > 0 && (
          <Link to="/admin/tickets?priority=CRITIQUE" className="alerts__item alerts__item--critical">
            ⚠ {data.critical.length} {t('ticket(s) critique(s) ouvert(s)', 'open critical ticket(s)')}
          </Link>
        )}
        {data.late.length > 0 && (
          <Link to="/admin/tickets?late=true" className="alerts__item alerts__item--late">
            ⏱ {data.late.length} {t('ticket(s) en retard', 'overdue ticket(s)')}
          </Link>
        )}
      </div>
    </div>
  );
}
