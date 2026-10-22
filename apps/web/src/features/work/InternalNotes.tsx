import { useState, type FormEvent } from 'react';
import { SETTINGS, type InternalNoteDto } from '@smartcampus/shared';
import { ApiRequestError, api } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import { useI18n } from '../../lib/i18n';
import { useLive } from '../../lib/live';
import { useApi } from '../../lib/useApi';

/** US-15 : notes internes, visibles uniquement des agents et des admins. */
export function InternalNotes({ incidentId }: { incidentId: string }) {
  const { t, lang } = useI18n();
  const { data, reload } = useApi<InternalNoteDto[]>(`/incidents/${incidentId}/notes`);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useLive((e) => e.type === 'incident.changed' && e.id === incidentId && reload());

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/incidents/${incidentId}/notes`, { body });
      setBody('');
      reload();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t('Envoi impossible.', 'Could not save.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card notes">
      <h2>
        {t('Notes internes', 'Internal notes')} <span className="notes__lock">🔒 {t('non visibles par l’étudiant', 'hidden from the student')}</span>
      </h2>
      {data && data.length === 0 && <p className="muted">{t('Aucune note pour le moment.', 'No notes yet.')}</p>}
      <ul className="notes__list">
        {data?.map((n) => (
          <li key={n.id}>
            <p className="notes__body">{n.body}</p>
            <p className="notes__meta">
              {n.author.name} · <time dateTime={n.createdAt}>{formatDateTime(n.createdAt, lang)}</time>
            </p>
          </li>
        ))}
      </ul>
      <form onSubmit={submit} className="notes__form">
        <label htmlFor="note-body" className="sr-only">
          {t('Nouvelle note interne', 'New internal note')}
        </label>
        <textarea
          id="note-body"
          value={body}
          maxLength={SETTINGS.note.max}
          placeholder={t('Information technique, pièce commandée…', 'Technical info, part ordered…')}
          onChange={(e) => setBody(e.target.value)}
        />
        {error && <p className="field__error">{error}</p>}
        <button type="submit" className="btn btn--secondary btn--sm" disabled={busy || !body.trim()}>
          {t('Ajouter la note', 'Add note')}
        </button>
      </form>
    </section>
  );
}
