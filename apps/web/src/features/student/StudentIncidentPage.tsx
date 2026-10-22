import { Link, useParams } from 'react-router';
import type { IncidentDetail } from '@smartcampus/shared';
import { IncidentView } from '../../components/IncidentView';
import { useI18n } from '../../lib/i18n';
import { useLive } from '../../lib/live';
import { useApi } from '../../lib/useApi';

/** US-09 : détail et historique d'un ticket de l'étudiant, à jour en temps réel. */
export function StudentIncidentPage() {
  const { id } = useParams();
  const { t } = useI18n();
  const { data, error, loading, reload } = useApi<IncidentDetail>(`/incidents/${id}`);
  useLive((e) => e.type === 'incident.changed' && e.id === id && reload());

  return (
    <section>
      <Link to="/etudiant" className="back-link">
        ← {t('Mes signalements', 'My reports')}
      </Link>
      {loading && !data && <p className="muted">{t('Chargement…', 'Loading…')}</p>}
      {error && <p className="alert alert--error">{error.status === 404 ? t('Ce ticket est introuvable.', 'This ticket cannot be found.') : error.message}</p>}
      {data && <IncidentView incident={data} linkBase="/etudiant/tickets" />}
    </section>
  );
}
