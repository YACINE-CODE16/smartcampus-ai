import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ROLE_LABELS, STATUS_LABELS, URGENCY_LABELS, type IncidentDetail, type IncidentEventDto } from '@smartcampus/shared';
import { formatDateTime } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { LateBadge, PriorityBadge, StatusBadge } from './Badges';
import { LocationPlate } from './LocationPlate';

/** US-09 : historique de traitement, du plus ancien au plus récent. */
export function Timeline({ events }: { events: IncidentEventDto[] }) {
  const { t, label, text, lang } = useI18n();

  function title(e: IncidentEventDto): string {
    switch (e.type) {
      case 'CREATED':
        return t('Ticket créé', 'Ticket created');
      case 'ASSIGN':
        return e.comment ? text(e.comment) : t('Affectation', 'Assignment');
      case 'UPDATE':
        return t('Ticket requalifié', 'Ticket requalified');
      case 'MERGE':
        return t('Fusion de doublon', 'Duplicate merge');
      case 'STATUS':
        return `${e.fromStatus ? label(STATUS_LABELS[e.fromStatus]) : '—'} → ${e.toStatus ? label(STATUS_LABELS[e.toStatus]) : '—'}`;
    }
  }

  return (
    <ol className="timeline">
      {events.map((e) => (
        <li key={e.id} className={`timeline__item timeline__item--${(e.toStatus ?? 'nouveau').toLowerCase()}`}>
          <p className="timeline__title">{title(e)}</p>
          <p className="timeline__meta">
            <span>{e.author?.name ?? label(ROLE_LABELS.SYSTEM)}</span>
            <span className="timeline__role">{label(ROLE_LABELS[e.authorRole])}</span>
            <time dateTime={e.createdAt}>{formatDateTime(e.createdAt, lang)}</time>
          </p>
          {e.comment && e.type !== 'ASSIGN' && <blockquote className="timeline__comment">{text(e.comment)}</blockquote>}
        </li>
      ))}
    </ol>
  );
}

interface Props {
  incident: IncidentDetail;
  /** Actions propres au rôle, affichées sous l'en-tête. */
  actions?: ReactNode;
  /** Panneau supplémentaire sous l'historique (ex. notes internes). */
  aside?: ReactNode;
  showOwner?: boolean;
  /** Préfixe des liens vers d'autres tickets (`/agent/tickets`…). */
  linkBase?: string;
}

/** Détail d'un ticket, commun aux trois espaces. */
export function IncidentView({ incident: x, actions, aside, showOwner = false, linkBase }: Props) {
  const { t, label, text, category, lang } = useI18n();
  return (
    <article className="incident">
      <header className="incident__head">
        <LocationPlate building={x.building} room={x.room} />
        <div className="incident__heading">
          <p className="incident__number">{x.ticketNumber}</p>
          <h1>
            {category(x.category)} <span className="incident__where">{x.building.name}</span>
          </h1>
          <div className="incident__badges">
            <StatusBadge status={x.status} />
            <PriorityBadge priority={x.priority} />
            {x.isLate && <LateBadge />}
          </div>
        </div>
      </header>

      {actions}

      <div className="incident__grid">
        <section className="panel">
          <h2 className="panel__title">{t('Description', 'Description')}</h2>
          <p className="incident__description">{text(x.description)}</p>
          {x.rejectionReason && (
            <p className="callout callout--danger">
              <strong>{t('Motif du rejet', 'Rejection reason')}</strong> {text(x.rejectionReason)}
              {x.mergedInto && linkBase && (
                <>
                  {' '}
                  <Link to={`${linkBase}/${x.mergedInto.id}`}>{t('Ouvrir le ticket principal', 'Open the main ticket')}</Link>
                </>
              )}
            </p>
          )}
          {x.hasPhoto && (
            <figure className="incident__photo">
              <a href={`/api/incidents/${x.id}/photo`} target="_blank" rel="noreferrer">
                <img src={`/api/incidents/${x.id}/photo`} alt={t(`Photo jointe au ticket ${x.ticketNumber}`, `Photo attached to ticket ${x.ticketNumber}`)} loading="lazy" />
              </a>
            </figure>
          )}
          <dl className="facts">
            <div>
              <dt>{t('Lieu', 'Location')}</dt>
              <dd>
                {x.building.name}, {x.room}
              </dd>
            </div>
            <div>
              <dt>{t('Urgence ressentie', 'Perceived urgency')}</dt>
              <dd>{label(URGENCY_LABELS[x.urgency])}</dd>
            </div>
            {showOwner && (
              <div>
                <dt>{t('Signalé par', 'Reported by')}</dt>
                <dd>{x.owner.name}</dd>
              </div>
            )}
            <div>
              <dt>{t('Créé le', 'Created on')}</dt>
              <dd>{formatDateTime(x.createdAt, lang)}</dd>
            </div>
            <div>
              <dt>{t('Agent', 'Agent')}</dt>
              <dd>{x.assignedTo?.name ?? t('Pas encore affecté', 'Not assigned yet')}</dd>
            </div>
            {x.reopenCount > 0 && (
              <div>
                <dt>{t('Réouvertures', 'Reopened')}</dt>
                <dd>{x.reopenCount}</dd>
              </div>
            )}
          </dl>
        </section>

        <div className="incident__side">
          <section className="panel">
            <h2 className="panel__title">{t('Historique', 'History')}</h2>
            <Timeline events={x.events} />
          </section>
          {aside}
        </div>
      </div>
    </article>
  );
}
