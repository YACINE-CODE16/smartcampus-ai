import { useState, type FormEvent } from 'react';
import type { FaqEntryDto, KbDocumentDto, Lang } from '@smartcampus/shared';
import { ApiRequestError, api } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import { useI18n } from '../../lib/i18n';
import { useApi } from '../../lib/useApi';

const TOPICS = ['reseau', 'salle', 'materiel', 'proprete', 'securite', 'autre'];

function errorText(err: unknown, fallback: string) {
  if (err instanceof ApiRequestError) return Object.entries(err.fields).map(([k, v]) => `${k} : ${v}`).join(' · ') || err.message;
  return fallback;
}

/** Formulaire FAQ (création ou modification). */
function FaqForm({ initial, onDone, onCancel }: { initial?: FaqEntryDto; onDone(): void; onCancel?(): void }) {
  const { t } = useI18n();
  const [v, setV] = useState({
    question: initial?.question ?? '',
    answer: initial?.answer ?? '',
    questionEn: initial?.questionEn ?? '',
    answerEn: initial?.answerEn ?? '',
    keywords: initial?.keywords.join(', ') ?? '',
    topic: initial?.topic ?? 'autre',
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value });

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    setBusy(true);
    setError(null);
    const body = {
      ...v,
      questionEn: v.questionEn.trim() || null,
      answerEn: v.answerEn.trim() || null,
      keywords: v.keywords.split(',').map((k) => k.trim()).filter(Boolean),
    };
    try {
      if (initial) await api.patch(`/admin/kb/faq/${initial.id}`, body);
      else await api.post('/admin/kb/faq', body);
      onDone();
    } catch (err) {
      setError(errorText(err, t('Enregistrement impossible.', 'Could not save.')));
    } finally {
      setBusy(false);
    }
  }

  const p = initial?.id ?? 'new';
  return (
    <form className="form kb-form" onSubmit={submit}>
      <div className="row-2">
        <div className="field">
          <label htmlFor={`q-${p}`}>{t('Question (FR)', 'Question (FR)')}</label>
          <input id={`q-${p}`} value={v.question} onChange={set('question')} required />
        </div>
        <div className="field">
          <label htmlFor={`qe-${p}`}>{t('Question (EN)', 'Question (EN)')}</label>
          <input id={`qe-${p}`} value={v.questionEn} onChange={set('questionEn')} />
        </div>
        <div className="field">
          <label htmlFor={`a-${p}`}>{t('Réponse (FR)', 'Answer (FR)')}</label>
          <textarea id={`a-${p}`} value={v.answer} onChange={set('answer')} required />
        </div>
        <div className="field">
          <label htmlFor={`ae-${p}`}>{t('Réponse (EN)', 'Answer (EN)')}</label>
          <textarea id={`ae-${p}`} value={v.answerEn} onChange={set('answerEn')} />
        </div>
        <div className="field">
          <label htmlFor={`k-${p}`}>{t('Mots-clés (séparés par des virgules)', 'Keywords (comma-separated)')}</label>
          <input id={`k-${p}`} value={v.keywords} onChange={set('keywords')} placeholder="vélo, parking vélo" />
        </div>
        <div className="field">
          <label htmlFor={`t-${p}`}>{t('Thème', 'Topic')}</label>
          <select id={`t-${p}`} value={v.topic} onChange={set('topic')}>
            {TOPICS.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </div>
      </div>
      {error && <p className="alert alert--error">{error}</p>}
      <div className="work__form-actions">
        <button type="submit" className="btn btn--primary" disabled={busy}>
          {initial ? t('Enregistrer', 'Save') : t('Ajouter à la FAQ', 'Add to FAQ')}
        </button>
        {onCancel && (
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            {t('Annuler', 'Cancel')}
          </button>
        )}
      </div>
    </form>
  );
}

function DocumentForm({ onDone }: { onDone(): void }) {
  const { t } = useI18n();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [language, setLanguage] = useState<Lang>('fr');
  const [error, setError] = useState<string | null>(null);

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    setError(null);
    try {
      await api.post('/admin/kb/documents', { title, content, language });
      setTitle('');
      setContent('');
      onDone();
    } catch (err) {
      setError(errorText(err, t('Enregistrement impossible.', 'Could not save.')));
    }
  }

  return (
    <form className="form kb-form" onSubmit={submit}>
      <div className="row-2">
        <div className="field">
          <label htmlFor="doc-title">{t('Titre', 'Title')}</label>
          <input id="doc-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="doc-lang">{t('Langue', 'Language')}</label>
          <select id="doc-lang" value={language} onChange={(e) => setLanguage(e.target.value as Lang)}>
            <option value="fr">Français</option>
            <option value="en">English</option>
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor="doc-content">{t('Contenu', 'Content')}</label>
        <textarea id="doc-content" className="kb-form__content" value={content} onChange={(e) => setContent(e.target.value)} required />
      </div>
      {error && <p className="alert alert--error">{error}</p>}
      <div>
        <button type="submit" className="btn btn--primary">
          {t('Ajouter le document', 'Add document')}
        </button>
      </div>
    </form>
  );
}

/** US-24 : base documentaire de l'assistant (FAQ bilingue + documents). */
export function KnowledgePage() {
  const { t, lang } = useI18n();
  const [tab, setTab] = useState<'faq' | 'docs'>('faq');
  const [editing, setEditing] = useState<string | null>(null);
  const faq = useApi<FaqEntryDto[]>('/admin/kb/faq');
  const docs = useApi<KbDocumentDto[]>('/admin/kb/documents');

  async function remove(path: string, reload: () => void) {
    if (!window.confirm(t('Supprimer définitivement cette entrée ?', 'Delete this entry permanently?'))) return;
    await api.delete(path).catch(() => undefined);
    reload();
  }

  return (
    <section className="kb">
      <h1>{t('Base documentaire de l’assistant', 'Assistant knowledge base')}</h1>
      <p className="muted">
        {t(
          'L’assistant répond uniquement à partir de ces contenus et des tickets de l’étudiant. Toute modification est prise en compte immédiatement.',
          'The assistant only answers from this content and the student’s own tickets. Changes apply immediately.',
        )}
      </p>
      <div className="subtabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'faq'} className="subtabs__btn" onClick={() => setTab('faq')}>
          FAQ <span className="count">{faq.data?.length ?? 0}</span>
        </button>
        <button type="button" role="tab" aria-selected={tab === 'docs'} className="subtabs__btn" onClick={() => setTab('docs')}>
          {t('Documents', 'Documents')} <span className="count">{docs.data?.length ?? 0}</span>
        </button>
      </div>

      {tab === 'faq' && (
        <>
          <details className="card kb-new">
            <summary>+ {t('Nouvelle question', 'New question')}</summary>
            <FaqForm onDone={faq.reload} />
          </details>
          <ul className="kb-list">
            {faq.data?.map((f) => (
              <li key={f.id} className="card">
                {editing === f.id ? (
                  <FaqForm
                    initial={f}
                    onCancel={() => setEditing(null)}
                    onDone={() => {
                      setEditing(null);
                      faq.reload();
                    }}
                  />
                ) : (
                  <>
                    <p className="kb-list__q">{lang === 'en' && f.questionEn ? f.questionEn : f.question}</p>
                    <p className="kb-list__a">{lang === 'en' && f.answerEn ? f.answerEn : f.answer}</p>
                    <p className="kb-list__meta">
                      {f.keywords.slice(0, 8).map((k) => (
                        <span key={k} className="tag">
                          {k}
                        </span>
                      ))}
                      {!f.questionEn && <span className="badge badge--late">{t('Traduction EN manquante', 'EN translation missing')}</span>}
                    </p>
                    <div className="work__form-actions">
                      <button type="button" className="btn btn--secondary btn--sm" onClick={() => setEditing(f.id)}>
                        {t('Modifier', 'Edit')}
                      </button>
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => void remove(`/admin/kb/faq/${f.id}`, faq.reload)}>
                        {t('Supprimer', 'Delete')}
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {tab === 'docs' && (
        <>
          <details className="card kb-new">
            <summary>+ {t('Nouveau document', 'New document')}</summary>
            <DocumentForm onDone={docs.reload} />
          </details>
          <ul className="kb-list">
            {docs.data?.map((d) => (
              <li key={d.id} className="card">
                <p className="kb-list__q">
                  {d.title} <span className="tag">{d.language.toUpperCase()}</span>
                </p>
                <p className="kb-list__a">{d.content}</p>
                <p className="kb-list__meta">
                  {t('Mis à jour le', 'Updated')} {formatDateTime(d.updatedAt, lang)}
                </p>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => void remove(`/admin/kb/documents/${d.id}`, docs.reload)}>
                  {t('Supprimer', 'Delete')}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
