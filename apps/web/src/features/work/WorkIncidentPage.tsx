import { Link, useParams } from 'react-router';
import type { AgentDto, IncidentDetail, Referentials } from '@smartcampus/shared';
import { IncidentView } from '../../components/IncidentView';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { touches, useLive } from '../../lib/live';
import { useApi } from '../../lib/useApi';
import { InternalNotes } from './InternalNotes';
import { WorkPanel } from './WorkPanel';

/** Détail d'un ticket côté agent ou admin : actions de traitement + notes internes. */
export function WorkIncidentPage({ base }: { base: '/agent' | '/admin/tickets' }) {
  const { id } = useParams();
  const { user } = useAuth();
  const { t } = useI18n();
  const isAdmin = user?.role === 'ADMIN';
  const { data, error, loading, reload } = useApi<IncidentDetail>(`/incidents/${id}`);
  const { data: refs } = useApi<Referentials>('/incidents/referentials');
  const { data: agents, reload: reloadAgents } = useApi<AgentDto[]>(isAdmin ? '/users/agents' : null);
  const incident = data;
  const linkBase = base === '/agent' ? '/agent/tickets' : '/admin/tickets';

  useLive((e) => {
    if (touches(e, id)) reload();
  });

  return (
    <section>
      <Link to={base} className="back-link">
        ← {t('Retour aux tickets', 'Back to tickets')}
      </Link>
      {loading && !incident && <p className="muted">{t('Chargement…', 'Loading…')}</p>}
      {error && (
        <p className="alert alert--error">
          {error.status === 404 ? t('Ticket introuvable ou affecté à un autre agent.', 'Ticket not found or assigned to another agent.') : error.message}
        </p>
      )}
      {incident && user && (
        <IncidentView
          incident={incident}
          showOwner
          linkBase={linkBase}
          actions={
            <WorkPanel
              user={user}
              incident={incident}
              refs={refs}
              agents={isAdmin ? (agents ?? []) : undefined}
              onChange={() => {
                reload();
                if (isAdmin) reloadAgents();
              }}
            />
          }
          aside={<InternalNotes incidentId={incident.id} />}
        />
      )}
    </section>
  );
}
