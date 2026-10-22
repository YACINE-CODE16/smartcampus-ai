import { useState } from 'react';
import { SETTINGS, type CategoryDto } from '@smartcampus/shared';
import { ApiRequestError, api } from '../../lib/api';
import { useI18n } from '../../lib/i18n';
import { useApi } from '../../lib/useApi';

/** Ligne d'une catégorie : délai cible modifiable, enregistré à la demande. */
function TargetRow({ c, onSaved }: { c: CategoryDto; onSaved(): void }) {
  const { t, category } = useI18n();
  const [value, setValue] = useState(String(c.targetHours));
  const [state, setState] = useState<{ kind: 'idle' | 'saving' | 'saved' } | { kind: 'error'; message: string }>({ kind: 'idle' });
  const dirty = value !== String(c.targetHours);

  async function save() {
    setState({ kind: 'saving' });
    try {
      await api.patch(`/admin/categories/${c.id}`, { targetHours: Number(value) });
      setState({ kind: 'saved' });
      onSaved();
    } catch (err) {
      setState({ kind: 'error', message: err instanceof ApiRequestError ? (Object.values(err.fields)[0] ?? err.message) : t('Échec', 'Failed') });
    }
  }

  return (
    <tr>
      <th scope="row">
        {category(c)}
        {c.autoPriority === 'CRITIQUE' && <span className="badge badge--prio-critique">⚠ {t('Critique', 'Critical')}</span>}
      </th>
      <td>
        <label className="sr-only" htmlFor={`target-${c.id}`}>
          {t(`Délai cible pour ${c.label}, en heures`, `Target time for ${c.labelEn || c.label}, in hours`)}
        </label>
        <input
          id={`target-${c.id}`}
          className="input-hours"
          type="number"
          inputMode="numeric"
          min={SETTINGS.targetHours.min}
          max={SETTINGS.targetHours.max}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setState({ kind: 'idle' });
          }}
        />{' '}
        h
      </td>
      <td>
        <button type="button" className="btn btn--secondary btn--sm" disabled={!dirty || state.kind === 'saving'} onClick={() => void save()}>
          {t('Enregistrer', 'Save')}
        </button>{' '}
        {state.kind === 'saved' && <span className="ok">✓ {t('Enregistré', 'Saved')}</span>}
        {state.kind === 'error' && <span className="field__error">{state.message}</span>}
      </td>
    </tr>
  );
}

/** US-18 : délais cibles de prise en charge par catégorie (24 h par défaut). */
export function AdminSettingsPage() {
  const { t } = useI18n();
  const { data, error, reload } = useApi<CategoryDto[]>('/admin/categories');

  return (
    <section className="settings">
      <h1>{t('Délais cibles de prise en charge', 'Pick-up target times')}</h1>
      <p className="muted">
        {t(
          `Un ticket encore « Nouveau » au-delà de ce délai est signalé en retard : l'administration est alertée et l'étudiant prévenu. Valeur par défaut : ${SETTINGS.defaultTargetHours} h.`,
          `A ticket still “New” beyond this time is flagged as overdue: the administration is alerted and the student notified. Default: ${SETTINGS.defaultTargetHours} h.`,
        )}
      </p>
      {error && <p className="alert alert--error">{error.message}</p>}
      {data && (
        <div className="card table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">{t('Catégorie', 'Category')}</th>
                <th scope="col">{t('Délai cible', 'Target time')}</th>
                <th scope="col">
                  <span className="sr-only">{t('Action', 'Action')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((c) => (
                <TargetRow key={c.id} c={c} onSaved={reload} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
