import { Bot } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import {
  allowedTransitions,
  canRequalify,
  canTake,
  isClosed,
  refOf,
  SETTINGS,
  URGENCIES,
  URGENCY_LABELS,
  type AgentDto,
  type IncidentDetail,
  type Referentials,
  type SessionUser,
  type Transition,
  type TriageSuggestion,
  type Urgency,
} from '@smartcampus/shared';
import { ApiRequestError, api } from '../../lib/api';
import { useI18n } from '../../lib/i18n';

type Mode = { kind: 'transition'; transition: Transition } | { kind: 'requalify' } | { kind: 'merge' } | null;

interface Props {
  user: SessionUser;
  incident: IncidentDetail;
  refs: Referentials | null;
  /** Agents assignables (admin uniquement, US-13). */
  agents?: AgentDto[];
  onChange(detail: IncidentDetail): void;
}

/** Actions de traitement (US-13, US-14, US-16, US-17), affichées selon les règles partagées. */
export function WorkPanel({ user, incident, refs, agents, onChange }: Props) {
  const { t, label, category } = useI18n();
  const [mode, setMode] = useState<Mode>(null);
  const [text, setText] = useState('');
  const [categoryId, setCategoryId] = useState(incident.category.id);
  const [urgency, setUrgency] = useState<Urgency>(incident.urgency);
  const [target, setTarget] = useState('');
  const [agentId, setAgentId] = useState(incident.assignedTo?.id ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // US-25 : suggestion de catégorie et d'urgence de l'IA sur chaque nouveau ticket.
  const [suggestion, setSuggestion] = useState<TriageSuggestion | null>(null);
  useEffect(() => {
    if (incident.status !== 'NOUVEAU') return;
    let cancelled = false;
    api
      .post<{ suggestion: TriageSuggestion | null }>('/assistant/triage', { description: incident.description })
      .then((r) => !cancelled && setSuggestion(r.suggestion))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [incident.id, incident.status, incident.description]);
  const suggestedCategory = suggestion ? refs?.categories.find((c) => c.slug === suggestion.categorySlug) : undefined;
  const suggestionDiffers =
    incident.status === 'NOUVEAU' &&
    suggestedCategory !== undefined &&
    (suggestedCategory.id !== incident.category.id || suggestion!.urgency !== incident.urgency);

  const ref = refOf(incident);
  const transitions = allowedTransitions(user, ref);
  const takeable = canTake(user, ref);
  const editable = canRequalify(user, ref);

  function open(next: Mode) {
    setMode(next);
    setText('');
    setError(null);
    if (next?.kind === 'requalify') {
      setCategoryId(incident.category.id);
      setUrgency(incident.urgency);
    }
  }

  async function run(action: () => Promise<IncidentDetail>) {
    setBusy(true);
    setError(null);
    try {
      onChange(await action());
      setMode(null);
      setText('');
    } catch (err) {
      setError(err instanceof ApiRequestError ? Object.values(err.fields)[0] ?? err.message : t('Action impossible.', 'Action failed.'));
    } finally {
      setBusy(false);
    }
  }

  function submit(ev: FormEvent) {
    ev.preventDefault();
    if (!mode) return;
    if (mode.kind === 'transition') {
      const x = mode.transition;
      void run(() => api.post(`/incidents/${incident.id}/transition`, x.requiresReason ? { to: x.to, reason: text } : { to: x.to, comment: text || undefined }));
    } else if (mode.kind === 'requalify') {
      void run(() => api.patch(`/incidents/${incident.id}`, { categoryId, urgency }));
    } else {
      void run(() => api.post(`/incidents/${incident.id}/merge`, { target }));
    }
  }

  const nothing = !takeable && transitions.length === 0 && !editable && !(agents && !isClosed(incident.status)) && !suggestionDiffers;
  if (nothing) return null;

  return (
    <section className="card work" aria-label={t('Actions de traitement', 'Handling actions')}>
      <div className="work__buttons">
        {takeable && (
          <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void run(() => api.post(`/incidents/${incident.id}/take`))}>
            {t('Prendre en charge', 'Take ticket')}
          </button>
        )}
        {transitions.map((x) => (
          <button
            key={x.to}
            type="button"
            className={`btn ${x.to === 'REJETE' ? 'btn--danger-outline' : 'btn--primary'} ${mode?.kind === 'transition' && mode.transition.to === x.to ? 'btn--active' : ''}`}
            disabled={busy}
            onClick={() => open({ kind: 'transition', transition: x })}
          >
            {label(x.action)}
          </button>
        ))}
        {editable && (
          <>
            <button type="button" className="btn btn--secondary" disabled={busy} onClick={() => open({ kind: 'requalify' })}>
              {t('Requalifier', 'Requalify')}
            </button>
            <button type="button" className="btn btn--secondary" disabled={busy} onClick={() => open({ kind: 'merge' })}>
              {t('Fusionner un doublon', 'Merge duplicate')}
            </button>
          </>
        )}
      </div>

      {suggestionDiffers && suggestion && suggestedCategory && (
        <div className="ai-suggest" role="status">
          <Bot size={18} strokeWidth={1.75} aria-hidden="true" />
          <span className="ai-suggest__text">
            {t('Suggestion de l’assistant :', 'Assistant suggestion:')} <strong>{category(suggestedCategory)}</strong>, {t('urgence', 'urgency')}{' '}
            {label(URGENCY_LABELS[suggestion.urgency]).toLowerCase()}
            {!editable && <span className="quiet"> {t('(prenez le ticket en charge pour l’appliquer)', '(take the ticket to apply it)')}</span>}
          </span>
          {editable && (
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              disabled={busy}
              onClick={() => void run(() => api.patch(`/incidents/${incident.id}`, { categoryId: suggestedCategory.id, urgency: suggestion.urgency }))}
            >
              {t('Appliquer', 'Apply')}
            </button>
          )}
        </div>
      )}

      {agents && !isClosed(incident.status) && (
        <form
          className="work__assign"
          onSubmit={(e) => {
            e.preventDefault();
            void run(() => api.post(`/incidents/${incident.id}/assign`, { agentId }));
          }}
        >
          <label htmlFor="assign-agent">{t('Affecter à', 'Assign to')}</label>
          <select id="assign-agent" value={agentId} onChange={(e) => setAgentId(e.target.value)}>
            <option value="">{t('Choisir un agent…', 'Choose an agent…')}</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.openCount} {t('ouvert(s)', 'open')})
              </option>
            ))}
          </select>
          <button type="submit" className="btn btn--secondary" disabled={busy || !agentId || agentId === incident.assignedTo?.id}>
            {t('Affecter', 'Assign')}
          </button>
        </form>
      )}

      {mode && (
        <form className="work__form" onSubmit={submit}>
          {mode.kind === 'transition' && (
            <div className="field">
              <label htmlFor="work-text">
                {mode.transition.requiresReason
                  ? t('Motif du rejet (obligatoire, visible par l’étudiant)', 'Rejection reason (required, visible to the student)')
                  : t('Commentaire pour l’étudiant (facultatif)', 'Comment for the student (optional)')}
              </label>
              <textarea
                id="work-text"
                value={text}
                maxLength={mode.transition.requiresReason ? SETTINGS.reason.max : SETTINGS.comment.max}
                onChange={(e) => setText(e.target.value)}
                required={mode.transition.requiresReason}
                autoFocus
              />
            </div>
          )}
          {mode.kind === 'requalify' && (
            <div className="row-2">
              <div className="field">
                <label htmlFor="work-cat">{t('Type', 'Type')}</label>
                <select id="work-cat" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  {refs?.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {category(c)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="work-urg">{t('Urgence', 'Urgency')}</label>
                <select id="work-urg" value={urgency} onChange={(e) => setUrgency(e.target.value as Urgency)}>
                  {URGENCIES.map((u) => (
                    <option key={u} value={u}>
                      {label(URGENCY_LABELS[u])}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
          {mode.kind === 'merge' && (
            <div className="field">
              <label htmlFor="work-target">{t('Numéro du ticket principal', 'Main ticket number')}</label>
              <input id="work-target" value={target} placeholder="SC-0009" onChange={(e) => setTarget(e.target.value)} required autoFocus />
              <p className="field__help">
                {t(
                  `${incident.ticketNumber} passera « Rejeté » avec le motif « Doublon de … » et son auteur sera prévenu.`,
                  `${incident.ticketNumber} will be “Rejected” as “Duplicate of …” and its author notified.`,
                )}
              </p>
            </div>
          )}
          <div className="work__form-actions">
            <button type="submit" className="btn btn--primary" disabled={busy}>
              {busy ? t('Envoi…', 'Saving…') : t('Valider', 'Confirm')}
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => open(null)}>
              {t('Annuler', 'Cancel')}
            </button>
          </div>
        </form>
      )}
      {error && (
        <p className="alert alert--error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
