import { Info, SendHorizontal, ThumbsDown, ThumbsUp } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import type { AssistantMessageInput, AssistantReplyDto, Referentials } from '@smartcampus/shared';
import { ApiRequestError, api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { useApi } from '../../lib/useApi';
import type { ReportPrefill } from './ReportPage';

type Message =
  | { id: string; role: 'user'; content: string }
  | { id: string; role: 'assistant'; reply: AssistantReplyDto; feedback: boolean | null }
  | { id: string; role: 'error'; content: string };

/** Conversation conservée le temps de la session de l'onglet (pas côté serveur, D20). */
function storageKey(userId: string) {
  return `sc_chat_${userId}`;
}
function loadMessages(userId: string): Message[] {
  try {
    return JSON.parse(sessionStorage.getItem(storageKey(userId)) ?? '[]') as Message[];
  } catch {
    return [];
  }
}

/** US-19 à US-23, US-26 : assistant IA de l'étudiant. */
export function AssistantPage() {
  const { user } = useAuth();
  const { t, category } = useI18n();
  const navigate = useNavigate();
  const { data: refs } = useApi<Referentials>('/incidents/referentials');
  const [messages, setMessages] = useState<Message[]>(() => (user ? loadMessages(user.id) : []));
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    try {
      sessionStorage.setItem(storageKey(user.id), JSON.stringify(messages.slice(-30)));
    } catch {
      // stockage indisponible : la conversation reste en mémoire
    }
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, user]);

  const starters = [
    t('Le wifi ne marche pas, je fais quoi ?', 'The Wi-Fi is not working, what should I do?'),
    t('Où en est mon ticket ?', 'Where is my ticket?'),
    t('La porte de la salle B204 est bloquée', 'The door of room B204 is stuck'),
  ];

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    const history = messages.flatMap((m): AssistantMessageInput[] =>
      m.role === 'user' ? [{ role: 'user', content: m.content }] : m.role === 'assistant' ? [{ role: 'assistant', content: m.reply.answer }] : [],
    );
    setMessages((ms) => [...ms, { id: crypto.randomUUID(), role: 'user', content: message }]);
    setInput('');
    setBusy(true);
    try {
      const reply = await api.post<AssistantReplyDto>('/assistant/ask', { message, history: history.slice(-6) });
      setMessages((ms) => [...ms, { id: reply.interactionId, role: 'assistant', reply, feedback: null }]);
    } catch (err) {
      setMessages((ms) => [
        ...ms,
        { id: crypto.randomUUID(), role: 'error', content: err instanceof ApiRequestError ? err.message : t('L’assistant est indisponible.', 'The assistant is unavailable.') },
      ]);
    } finally {
      setBusy(false);
    }
  }

  async function rate(id: string, helpful: boolean, current: boolean | null) {
    const next = current === helpful ? null : helpful;
    setMessages((ms) => ms.map((m) => (m.id === id && m.role === 'assistant' ? { ...m, feedback: next } : m)));
    await api.post(`/assistant/interactions/${id}/feedback`, { helpful: next }).catch(() => undefined);
  }

  function createTicket(reply: AssistantReplyDto) {
    const s = reply.suggestedTicket!;
    const prefill: ReportPrefill = { ...s, interactionId: reply.interactionId };
    navigate('/etudiant/signaler', { state: { prefill } });
  }

  function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    void send(input);
  }

  return (
    <section className="assistant">
      <div className="page-head">
        <h1>{t('Assistant IA', 'AI assistant')}</h1>
        {messages.length > 0 && (
          <button type="button" className="btn btn--quiet btn--sm" onClick={() => setMessages([])}>
            {t('Nouvelle conversation', 'New conversation')}
          </button>
        )}
      </div>

      {/* US-26 : mention IA permanente */}
      <p className="ai-banner" role="note">
        <Info size={18} strokeWidth={1.75} aria-hidden="true" />
        {t(
          'Vous échangez avec une IA. Elle répond uniquement à partir de la FAQ du campus et de vos propres tickets ; ses réponses peuvent être incomplètes.',
          'You are chatting with an AI. It only answers from the campus FAQ and your own tickets; its answers may be incomplete.',
        )}
      </p>

      <div className="chat" aria-live="polite" aria-busy={busy}>
        {messages.length === 0 && (
          <div className="chat__empty">
            <p className="muted">{t('Exemples de questions :', 'Try asking:')}</p>
            <div className="chat__starters">
              {starters.map((s) => (
                <button key={s} type="button" className="btn btn--secondary btn--sm" onClick={() => void send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => {
          if (m.role === 'user') {
            return (
              <div key={m.id} className="bubble bubble--user">
                <span className="sr-only">{t('Vous :', 'You:')}</span>
                {m.content}
              </div>
            );
          }
          if (m.role === 'error') {
            return (
              <p key={m.id} className="alert alert--error">
                {m.content}
              </p>
            );
          }
          const r = m.reply;
          const s = r.suggestedTicket;
          const suggestedCategory = s && refs?.categories.find((c) => c.slug === s.categorySlug);
          const suggestedBuilding = s?.buildingCode && refs?.buildings.find((b) => b.code === s.buildingCode);
          return (
            <div key={m.id} className="bubble bubble--ai">
              <span className="ai-chip" aria-label={t('Réponse de l’IA', 'AI answer')}>
                IA
              </span>
              <p className="bubble__text">{r.answer}</p>

              {/* US-20 : source de la réponse */}
              {r.sources.length > 0 && (
                <p className="bubble__source">
                  {t('Source :', 'Source:')}{' '}
                  {r.sources.map((src) => `${src.type === 'faq' ? 'FAQ' : t('document', 'document')} « ${src.title} »`).join(', ')}
                </p>
              )}
              {r.kind === 'ticket_status' && (
                <p className="bubble__source">
                  {t('Source : vos tickets', 'Source: your tickets')}
                  {r.tickets?.map((x, i) => (
                    <span key={x.id}>
                      {i === 0 ? ' : ' : ', '}
                      <Link to={`/etudiant/tickets/${x.id}`}>{x.ticketNumber}</Link>
                    </span>
                  ))}
                </p>
              )}

              {/* US-21 : ticket pré-rempli, validé par l'étudiant */}
              {s && (
                <div className="suggestion">
                  <p className="suggestion__title">{t('Signalement proposé', 'Suggested report')}</p>
                  <dl className="facts facts--compact">
                    <dt>{t('Type', 'Type')}</dt>
                    <dd>{suggestedCategory ? category(suggestedCategory) : s.categorySlug}</dd>
                    {suggestedBuilding && (
                      <>
                        <dt>{t('Lieu', 'Location')}</dt>
                        <dd>
                          {suggestedBuilding.name}
                          {s.room ? ` — ${s.room}` : ''}
                        </dd>
                      </>
                    )}
                  </dl>
                  <button type="button" className="btn btn--primary btn--sm" onClick={() => createTicket(r)}>
                    {t('Créer ce ticket', 'Create this ticket')}
                  </button>
                </div>
              )}

              {/* US-23 : avis sur la réponse */}
              <div className="feedback" role="group" aria-label={t('Cette réponse vous a-t-elle aidé ?', 'Was this answer helpful?')}>
                <button type="button" className="feedback__btn" aria-pressed={m.feedback === true} onClick={() => void rate(m.id, true, m.feedback)}>
                  <ThumbsUp size={16} strokeWidth={1.75} aria-hidden="true" />
                  <span className="sr-only">{t('Utile', 'Helpful')}</span>
                </button>
                <button type="button" className="feedback__btn" aria-pressed={m.feedback === false} onClick={() => void rate(m.id, false, m.feedback)}>
                  <ThumbsDown size={16} strokeWidth={1.75} aria-hidden="true" />
                  <span className="sr-only">{t('Pas utile', 'Not helpful')}</span>
                </button>
              </div>
            </div>
          );
        })}
        {busy && <p className="chat__typing">{t('L’assistant réfléchit…', 'The assistant is thinking…')}</p>}
        <div ref={endRef} />
      </div>

      <form className="chat__form" onSubmit={onSubmit}>
        <label htmlFor="chat-input" className="sr-only">
          {t('Votre question', 'Your question')}
        </label>
        <input
          id="chat-input"
          value={input}
          maxLength={1000}
          autoComplete="off"
          placeholder={t('Posez votre question…', 'Ask your question…')}
          onChange={(e) => setInput(e.target.value)}
        />
        <button type="submit" className="btn btn--primary" disabled={busy || input.trim().length < 2}>
          <SendHorizontal size={16} strokeWidth={2} aria-hidden="true" />
          {t('Envoyer', 'Send')}
        </button>
      </form>
    </section>
  );
}
