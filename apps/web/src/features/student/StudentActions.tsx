import { useState, type FormEvent } from 'react';
import { canRate, refOf, SETTINGS, type IncidentDetail, type SessionUser } from '@smartcampus/shared';
import { ApiRequestError, api } from '../../lib/api';
import { useI18n } from '../../lib/i18n';

/** Étoiles 1–5 accessibles (groupe de boutons radio). */
function Stars({ value, onChange }: { value: number; onChange(v: number): void }) {
  const { t } = useI18n();
  return (
    <div className="stars" role="radiogroup" aria-label={t('Note de 1 à 5', 'Rating from 1 to 5')}>
      {[1, 2, 3, 4, 5].map((n) => (
        <label key={n} className={`stars__star ${n <= value ? 'stars__star--on' : ''}`}>
          <input type="radio" name="score" value={n} checked={value === n} onChange={() => onChange(n)} />
          <span aria-hidden="true">★</span>
          <span className="sr-only">{t(`${n} étoile(s)`, `${n} star(s)`)}</span>
        </label>
      ))}
    </div>
  );
}

/** US-11 (confirmer / contester) et US-12 (noter), côté étudiant propriétaire. */
export function StudentActions({ user, incident, onChange }: { user: SessionUser; incident: IncidentDetail; onChange(): void }) {
  const { t } = useI18n();
  const [contesting, setContesting] = useState(false);
  const [comment, setComment] = useState('');
  const [score, setScore] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isOwnerResolved = incident.status === 'RESOLU' && incident.owner.id === user.id;
  const rateable = canRate(user, refOf(incident), incident.rating !== null);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      setContesting(false);
      setComment('');
      onChange();
    } catch (err) {
      setError(err instanceof ApiRequestError ? (Object.values(err.fields)[0] ?? err.message) : t('Action impossible.', 'Action failed.'));
    } finally {
      setBusy(false);
    }
  }

  function submitContest(ev: FormEvent) {
    ev.preventDefault();
    void run(() => api.post(`/incidents/${incident.id}/transition`, { to: 'EN_COURS', comment }));
  }

  function submitRating(ev: FormEvent) {
    ev.preventDefault();
    void run(() => api.post(`/incidents/${incident.id}/rating`, { score, comment: ratingComment || undefined }));
  }

  if (!isOwnerResolved && !rateable && !incident.rating) return null;

  return (
    <section className="card work student-actions">
      {isOwnerResolved && (
        <>
          <p className="student-actions__lead">
            {t('L’agent indique que le problème est résolu. Est-ce bien le cas ?', 'The agent says the issue is resolved. Is it?')}
          </p>
          <div className="work__buttons">
            <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void run(() => api.post(`/incidents/${incident.id}/transition`, { to: 'FERME' }))}>
              ✓ {t('Confirmer la résolution', 'Confirm resolution')}
            </button>
            <button type="button" className="btn btn--danger-outline" disabled={busy} aria-expanded={contesting} onClick={() => setContesting((c) => !c)}>
              {t('Contester', 'Dispute')}
            </button>
          </div>
          {contesting && (
            <form className="work__form" onSubmit={submitContest}>
              <div className="field">
                <label htmlFor="contest-comment">{t('Qu’est-ce qui ne va toujours pas ? (obligatoire)', 'What is still wrong? (required)')}</label>
                <textarea id="contest-comment" value={comment} maxLength={SETTINGS.comment.max} onChange={(e) => setComment(e.target.value)} required autoFocus />
              </div>
              <div className="work__form-actions">
                <button type="submit" className="btn btn--primary" disabled={busy || !comment.trim()}>
                  {t('Relancer le traitement', 'Reopen the ticket')}
                </button>
              </div>
            </form>
          )}
        </>
      )}

      {rateable && (
        <form className="rating" onSubmit={submitRating}>
          <p className="student-actions__lead">{t('Comment évaluez-vous le traitement de votre demande ?', 'How would you rate the handling of your request?')}</p>
          <Stars value={score} onChange={setScore} />
          <div className="field">
            <label htmlFor="rating-comment">{t('Commentaire (facultatif)', 'Comment (optional)')}</label>
            <textarea
              id="rating-comment"
              value={ratingComment}
              maxLength={SETTINGS.ratingComment.max}
              onChange={(e) => setRatingComment(e.target.value)}
            />
          </div>
          <div>
            <button type="submit" className="btn btn--secondary" disabled={busy || score === 0}>
              {t('Envoyer ma note', 'Send my rating')}
            </button>
          </div>
        </form>
      )}

      {incident.rating && (
        <p className="rating__done">
          {t('Votre note :', 'Your rating:')} <span aria-hidden="true">{'★'.repeat(incident.rating.score)}{'☆'.repeat(5 - incident.rating.score)}</span>
          <span className="sr-only">{incident.rating.score} / 5</span>
          {incident.rating.comment && <> — « {incident.rating.comment} »</>} · {t('merci !', 'thank you!')}
        </p>
      )}
      {error && (
        <p className="alert alert--error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
