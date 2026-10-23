import { useState } from 'react';
import { AUDIT_ACTIONS, ROLE_LABELS, type AuditAction, type AuditEntryDto } from '@smartcampus/shared';
import { formatDateTime } from '../../lib/format';
import { useI18n } from '../../lib/i18n';
import { useApi } from '../../lib/useApi';
import { TableWrap } from '../../components/TableWrap';

const ACTION_LABELS: Record<AuditAction, { fr: string; en: string }> = {
  ROLE_CHANGE: { fr: 'Changement de rôle', en: 'Role change' },
  REJECT: { fr: 'Rejet de ticket', en: 'Ticket rejected' },
  MERGE: { fr: 'Fusion de doublon', en: 'Duplicate merge' },
  DATA_DELETION: { fr: 'Suppression de données', en: 'Data erasure' },
  EXPORT: { fr: 'Export CSV', en: 'CSV export' },
};

/** Détails lisibles d'une entrée (les valeurs restent celles enregistrées). */
function details(e: AuditEntryDto, t: (fr: string, en: string) => string): string {
  const d = e.details as Record<string, unknown>;
  switch (e.action) {
    case 'ROLE_CHANGE':
      return `${String(d.from)} → ${String(d.to)}`;
    case 'REJECT':
      return `${String(d.ticket)} : ${String(d.reason ?? '').split('\u001f')[0]}`;
    case 'MERGE':
      return `${String(d.duplicate)} → ${String(d.target)}`;
    case 'DATA_DELETION':
      return t(`${String(d.tickets)} ticket(s), ${String(d.photos)} photo(s)`, `${String(d.tickets)} ticket(s), ${String(d.photos)} photo(s)`);
    case 'EXPORT': {
      const filters = Object.entries((d.filters ?? {}) as Record<string, unknown>).map(([k, v]) => `${k}=${String(v)}`);
      return `${String(d.count)} ${t('ligne(s)', 'row(s)')}${filters.length ? ` (${filters.join(', ')})` : ''}`;
    }
  }
}

/** US-37 : journal des actions sensibles (lecture seule). */
export function AuditPage() {
  const { t, label, lang } = useI18n();
  const [action, setAction] = useState<AuditAction | ''>('');
  const { data, error } = useApi<AuditEntryDto[]>(`/audit${action ? `?action=${action}` : ''}`);

  return (
    <section className="audit">
      <h1>{t('Journal d’audit', 'Audit log')}</h1>
      <p className="muted">{t('Actions sensibles, en lecture seule (200 plus récentes).', 'Sensitive actions, read-only (200 most recent).')}</p>
      <div className="field users__search">
        <label htmlFor="audit-action">{t('Action', 'Action')}</label>
        <select id="audit-action" value={action} onChange={(e) => setAction(e.target.value as AuditAction | '')}>
          <option value="">{t('Toutes', 'All')}</option>
          {AUDIT_ACTIONS.map((a) => (
            <option key={a} value={a}>
              {label(ACTION_LABELS[a])}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="alert alert--error">{error.message}</p>}
      {data && data.length === 0 && <p className="panel empty-state">{t('Aucune entrée.', 'No entries.')}</p>}
      {data && data.length > 0 && (
        <TableWrap label={t('Journal d’audit', 'Audit log')}>
          <table className="table table--compact">
            <thead>
              <tr>
                <th scope="col">{t('Date', 'Date')}</th>
                <th scope="col">{t('Action', 'Action')}</th>
                <th scope="col">{t('Auteur', 'By')}</th>
                <th scope="col">{t('Cible', 'Target')}</th>
                <th scope="col">{t('Détails', 'Details')}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((e) => (
                <tr key={e.id}>
                  <td className="nowrap">{formatDateTime(e.createdAt, lang)}</td>
                  <td>{label(ACTION_LABELS[e.action])}</td>
                  <td>
                    {e.actor?.name ?? '—'} <span className="cell-sub">{label(ROLE_LABELS[e.actorRole])}</span>
                  </td>
                  <td>{e.targetLabel ?? (e.targetType === 'incidents' ? t('Tickets', 'Tickets') : e.targetType)}</td>
                  <td>{details(e, t)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
    </section>
  );
}
