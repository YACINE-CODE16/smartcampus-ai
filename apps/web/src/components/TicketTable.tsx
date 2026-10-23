import { useNavigate } from 'react-router';
import type { IncidentSummary } from '@smartcampus/shared';
import { formatAgo, formatDateTime } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { LateBadge, PriorityBadge, StatusBadge } from './Badges';
import { LocationPlate } from './LocationPlate';

interface Props {
  items: IncidentSummary[];
  linkBase: string;
  empty: string;
  /** `student` : sans colonnes auteur/priorité. `work` : vue agent/admin complète. */
  variant: 'student' | 'work';
  caption: string;
}

/**
 * Liste de tickets en tableau (DESIGN.md : des lignes, pas des cartes).
 * Toute la ligne est cliquable ; le numéro reste un vrai lien pour le clavier.
 * Sous 760 px, chaque ligne s'empile.
 */
export function TicketTable({ items, linkBase, empty, variant, caption }: Props) {
  const { t, category, text, lang } = useI18n();
  const navigate = useNavigate();
  if (items.length === 0) return <p className="panel empty-state">{empty}</p>;

  const work = variant === 'work';
  return (
    <div className="panel table-panel">
      <table className="tickets">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{t('Ticket', 'Ticket')}</th>
            <th scope="col">{t('Lieu', 'Location')}</th>
            <th scope="col">{t('Statut', 'Status')}</th>
            {work && <th scope="col">{t('Priorité', 'Priority')}</th>}
            <th scope="col">{work ? t('Agent', 'Agent') : t('Suivi par', 'Handled by')}</th>
            <th scope="col" className="tickets__age">
              {t('Créé', 'Created')}
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((x) => {
            const href = `${linkBase}/${x.id}`;
            return (
              <tr
                key={x.id}
                className={x.priority === 'CRITIQUE' ? 'is-critical' : undefined}
                onClick={(e) => {
                  // Les clics sur le lien natif sont gérés par le navigateur (nouvel onglet, etc.).
                  if ((e.target as HTMLElement).closest('a')) return;
                  navigate(href);
                }}
              >
                <td className="tickets__main">
                  <a
                    href={href}
                    className="tickets__link"
                    onClick={(e) => {
                      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; // nouvel onglet : laisser faire le navigateur
                      e.preventDefault();
                      navigate(href);
                    }}
                  >
                    <span className="tickets__title">{text(x.excerpt)}</span>
                  </a>
                  <span className="tickets__meta">
                    <span className="tickets__number">{x.ticketNumber}</span>
                    <span>{category(x.category)}</span>
                    {work && <span>{x.owner.name}</span>}
                  </span>
                </td>
                <td>
                  <LocationPlate building={x.building} room={x.room} size="sm" />
                </td>
                <td>
                  <span className="tickets__status">
                    <StatusBadge status={x.status} />
                    {x.isLate && <LateBadge />}
                  </span>
                </td>
                {work && (
                  <td>
                    <PriorityBadge priority={x.priority} />
                  </td>
                )}
                <td className="tickets__agent">{x.assignedTo?.name ?? <span className="quiet">{t('Non affecté', 'Unassigned')}</span>}</td>
                <td className="tickets__age">
                  <time dateTime={x.createdAt} title={formatDateTime(x.createdAt, lang)}>
                    {formatAgo(x.createdAt, lang)}
                  </time>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
