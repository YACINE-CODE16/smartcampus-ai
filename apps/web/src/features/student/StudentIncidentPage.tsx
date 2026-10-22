import { Link, useParams } from 'react-router';
import type { IncidentDetail } from '@smartcampus/shared';
import { IncidentView } from '../../components/IncidentView';
import { useApi } from '../../lib/useApi';

/** US-09 : détail et historique d'un ticket de l'étudiant. */
export function StudentIncidentPage() {
  const { id } = useParams();
  const { data, error, loading } = useApi<IncidentDetail>(`/incidents/${id}`);

  return (
    <section>
      <Link to="/etudiant" className="back-link">
        ← Mes signalements
      </Link>
      {loading && !data && <p className="muted">Chargement…</p>}
      {error && <p className="alert alert--error">{error.status === 404 ? 'Ce ticket est introuvable.' : error.message}</p>}
      {data && <IncidentView incident={data} />}
    </section>
  );
}
