import type { ReactNode } from 'react';
import {
  ROLE_LABELS,
  STATUS_LABELS,
  URGENCY_LABELS,
  type IncidentDetail,
  type IncidentEventDto,
} from '@smartcampus/shared';
import { formatDateTime } from '../lib/format';
import { LateBadge, PriorityBadge, StatusBadge } from './Badges';

function eventTitle(e: IncidentEventDto): string {
  switch (e.type) {
    case 'CREATED':
      return 'Ticket créé';
    case 'ASSIGN':
      return e.comment ?? 'Affectation';
    case 'UPDATE':
      return 'Ticket modifié';
    case 'STATUS':
      return `${e.fromStatus ? STATUS_LABELS[e.fromStatus] : '—'} → ${e.toStatus ? STATUS_LABELS[e.toStatus] : '—'}`;
  }
}

/** US-09 : historique de traitement, du plus ancien au plus récent. */
export function Timeline({ events }: { events: IncidentEventDto[] }) {
  return (
    <ol className="timeline">
      {events.map((e) => (
        <li key={e.id} className={`timeline__item timeline__item--${(e.toStatus ?? 'nouveau').toLowerCase()}`}>
          <div className="timeline__head">
            <strong>{eventTitle(e)}</strong>
            <time dateTime={e.createdAt}>{formatDateTime(e.createdAt)}</time>
          </div>
          <p className="timeline__author">
            {e.author?.name ?? 'Système'} · {ROLE_LABELS[e.authorRole]}
          </p>
          {e.comment && e.type !== 'ASSIGN' && <p className="timeline__comment">« {e.comment} »</p>}
        </li>
      ))}
    </ol>
  );
}

/** Détail d'un ticket, commun aux trois espaces ; `actions` reçoit les boutons propres au rôle. */
export function IncidentView({ incident: t, actions, showOwner = false }: { incident: IncidentDetail; actions?: ReactNode; showOwner?: boolean }) {
  return (
    <article className="incident">
      <header className="incident__head">
        <p className="incident__number">{t.ticketNumber}</p>
        <h1>{t.title}</h1>
        <div className="incident__badges">
          <StatusBadge status={t.status} />
          <PriorityBadge priority={t.priority} />
          {t.isLate && <LateBadge />}
        </div>
      </header>

      {actions}

      <div className="incident__grid">
        <section className="card">
          <h2>Détails</h2>
          <dl className="facts">
            <dt>Type</dt>
            <dd>{t.category.label}</dd>
            <dt>Lieu</dt>
            <dd>
              {t.building.name} — {t.room}
            </dd>
            <dt>Urgence ressentie</dt>
            <dd>{URGENCY_LABELS[t.urgency]}</dd>
            {showOwner && (
              <>
                <dt>Signalé par</dt>
                <dd>{t.owner.name}</dd>
              </>
            )}
            <dt>Créé le</dt>
            <dd>{formatDateTime(t.createdAt)}</dd>
            <dt>Agent affecté</dt>
            <dd>{t.assignedTo?.name ?? 'Pas encore affecté'}</dd>
            {t.reopenCount > 0 && (
              <>
                <dt>Réouvertures</dt>
                <dd>{t.reopenCount}</dd>
              </>
            )}
          </dl>
          <h3 className="incident__subtitle">Description</h3>
          <p className="incident__description">{t.description}</p>
          {t.rejectionReason && (
            <p className="alert alert--error">
              <strong>Motif du rejet :</strong> {t.rejectionReason}
            </p>
          )}
          {t.hasPhoto && (
            <figure className="incident__photo">
              <a href={`/api/incidents/${t.id}/photo`} target="_blank" rel="noreferrer">
                <img src={`/api/incidents/${t.id}/photo`} alt={`Photo jointe au ticket ${t.ticketNumber}`} loading="lazy" />
              </a>
            </figure>
          )}
        </section>

        <section className="card">
          <h2>Historique</h2>
          <Timeline events={t.events} />
        </section>
      </div>
    </article>
  );
}
