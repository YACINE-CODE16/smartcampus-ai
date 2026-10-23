import { Bot, CircleCheck, FileText, ShieldCheck } from 'lucide-react';
import { StatusBadge } from '../../components/Badges';
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import {
  SETTINGS,
  STATUS_LABELS,
  URGENCIES,
  URGENCY_LABELS,
  type IncidentSummary,
  type Referentials,
  type TriageSuggestion,
  type Urgency,
} from '@smartcampus/shared';
import { ApiRequestError, api, uploadFile } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { formatAgo } from '../../lib/format';
import { useI18n } from '../../lib/i18n';
import { useApi } from '../../lib/useApi';

/** Valeurs de pré-remplissage (US-21 : envoyées par l'assistant via le state de navigation). */
export interface ReportPrefill {
  categorySlug?: string;
  buildingCode?: string;
  room?: string;
  description?: string;
  /** Échange de l'assistant à l'origine du ticket (statistiques US-31). */
  interactionId?: string;
}

type Field = 'categoryId' | 'buildingId' | 'room' | 'description' | 'photo' | '_';

/** US-07 : brouillon conservé sur l'appareil, par utilisateur (sans la photo, D17). */
interface Draft {
  categoryId: string | null;
  buildingId: string | null;
  room: string;
  description: string;
  urgency: Urgency;
}
const draftKey = (userId: string) => `sc_draft_${userId}`;
function readDraft(userId: string | undefined): Draft | null {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(draftKey(userId));
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

interface Similar {
  ticketNumber: string;
  title: string;
  status: IncidentSummary['status'];
  createdAt: string;
}
type Errors = Partial<Record<Field, string>>;

const MAX_BYTES = SETTINGS.maxPhotoMb * 1024 * 1024;

/** US-03 / US-04 / US-05 : signaler un incident. */
export function ReportPage() {
  const { t, label, category, lang } = useI18n();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const prefill = (location.state as { prefill?: ReportPrefill } | null)?.prefill;
  const { data: refs, error: refsError } = useApi<Referentials>('/incidents/referentials');
  // Un pré-remplissage de l'assistant l'emporte sur le brouillon.
  const [draft] = useState(() => (prefill ? null : readDraft(user?.id)));
  const [draftRestored, setDraftRestored] = useState(draft !== null);

  // `null` = pas encore choisi : on retombe alors sur la valeur pré-remplie (si elle existe).
  const [chosenCategoryId, setCategoryId] = useState<string | null>(draft?.categoryId ?? null);
  const [chosenBuildingId, setBuildingId] = useState<string | null>(draft?.buildingId ?? null);
  const [room, setRoom] = useState(prefill?.room ?? draft?.room ?? '');
  const [description, setDescription] = useState(prefill?.description ?? draft?.description ?? '');
  const [urgency, setUrgency] = useState<Urgency>(draft?.urgency ?? 'NORMALE');
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<IncidentSummary | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Pré-remplissage par slug/code, résolu dès que les référentiels sont chargés.
  const categoryId = chosenCategoryId ?? refs?.categories.find((c) => c.slug === prefill?.categorySlug)?.id ?? '';
  const buildingId = chosenBuildingId ?? refs?.buildings.find((b) => b.code === prefill?.buildingCode)?.id ?? '';
  const selectedCategory = refs?.categories.find((c) => c.id === categoryId);
  const photoError = t(
    `Photo JPG/PNG ou document PDF de ${SETTINGS.maxPhotoMb} Mo maximum`,
    `JPG/PNG photo or PDF document, ${SETTINGS.maxPhotoMb} MB max`,
  );

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  // US-07 : enregistrement automatique du brouillon (après une courte pause).
  useEffect(() => {
    if (!user || created) return;
    const timer = setTimeout(() => {
      try {
        const empty = !chosenCategoryId && !chosenBuildingId && !room.trim() && !description.trim();
        if (empty) localStorage.removeItem(draftKey(user.id));
        else {
          const d: Draft = { categoryId: chosenCategoryId, buildingId: chosenBuildingId, room, description, urgency };
          localStorage.setItem(draftKey(user.id), JSON.stringify(d));
        }
      } catch {
        // stockage indisponible : pas de brouillon
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [user, created, chosenCategoryId, chosenBuildingId, room, description, urgency]);

  function clearDraft() {
    if (user) {
      try {
        localStorage.removeItem(draftKey(user.id));
      } catch {
        // rien à faire
      }
    }
    setCategoryId(null);
    setBuildingId(null);
    setRoom('');
    setDescription('');
    setUrgency('NORMALE');
    setDraftRestored(false);
    setErrors({});
  }

  // US-06 : incident similaire déjà ouvert (même catégorie + même bâtiment).
  const [similar, setSimilar] = useState<Similar[]>([]);
  useEffect(() => {
    if (!categoryId || !buildingId) return;
    let cancelled = false;
    api
      .get<Similar[]>(`/incidents/similar?categoryId=${categoryId}&buildingId=${buildingId}`)
      .then((items) => !cancelled && setSimilar(items))
      .catch(() => !cancelled && setSimilar([]));
    return () => {
      cancelled = true;
    };
  }, [categoryId, buildingId]);
  const similarShown = categoryId && buildingId ? similar : [];

  // US-25 : suggestion de catégorie et d'urgence par l'IA, après une pause de saisie.
  const [suggestion, setSuggestion] = useState<TriageSuggestion | null>(null);
  useEffect(() => {
    const text = description.trim();
    if (text.length < SETTINGS.triageMinChars) return;
    const timer = setTimeout(() => {
      api
        .post<{ suggestion: TriageSuggestion | null }>('/assistant/triage', { description: text })
        .then((r) => setSuggestion(r.suggestion))
        .catch(() => setSuggestion(null));
    }, 700);
    return () => clearTimeout(timer);
  }, [description]);
  const suggestedCategory = suggestion ? refs?.categories.find((c) => c.slug === suggestion.categorySlug) : undefined;
  const showSuggestion =
    description.trim().length >= SETTINGS.triageMinChars &&
    suggestion !== null &&
    suggestedCategory !== undefined &&
    (suggestedCategory.id !== categoryId || suggestion.urgency !== urgency);

  function applySuggestion() {
    if (!suggestion || !suggestedCategory) return;
    changeCategory(suggestedCategory.id);
    setUrgency(suggestion.urgency);
  }

  function validate(): Errors {
    const e: Errors = {};
    if (!categoryId) e.categoryId = t('Choisissez un type', 'Choose a type');
    if (!buildingId) e.buildingId = t('Choisissez un bâtiment', 'Choose a building');
    if (!room.trim()) e.room = t('La salle est obligatoire', 'Room is required');
    const d = description.trim();
    if (!d) e.description = t('La description est obligatoire', 'Description is required');
    else if (d.length < SETTINGS.description.min)
      e.description = t(`Au moins ${SETTINGS.description.min} caractères`, `At least ${SETTINGS.description.min} characters`);
    return e;
  }

  /** Efface l'erreur d'un champ dès que l'utilisateur le corrige. */
  function edit<T>(field: Field, setter: (v: T) => void) {
    return (value: T) => {
      setter(value);
      setErrors((e) => (e[field] ? { ...e, [field]: undefined } : e));
    };
  }
  const changeCategory = edit('categoryId', setCategoryId);
  const changeBuilding = edit('buildingId', setBuildingId);
  const changeRoom = edit('room', setRoom);
  const changeDescription = edit('description', setDescription);

  function onPhoto(ev: ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0] ?? null;
    setErrors((e) => ({ ...e, photo: undefined }));
    if (!file) return;
    if (!SETTINGS.acceptedPhotoTypes.includes(file.type) || file.size > MAX_BYTES) {
      setErrors((e) => ({ ...e, photo: photoError }));
      ev.target.value = '';
      return;
    }
    setPhoto(file);
    // Aperçu pour une image ; un PDF est affiché par son nom de fichier.
    setPreview(file.type === 'application/pdf' ? null : URL.createObjectURL(file));
  }

  function removePhoto() {
    setPhoto(null);
    setPreview(null);
    if (fileInput.current) fileInput.current.value = '';
  }

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    const clientErrors = validate();
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length) {
      document.getElementById(`f-${Object.keys(clientErrors)[0]}`)?.focus();
      return;
    }
    setBusy(true);
    try {
      // US-04 : le fichier part directement vers le stockage (URL présignée), le ticket ne porte que sa clé.
      const attachmentKey = photo ? await uploadFile(photo) : undefined;
      setCreated(
        await api.post<IncidentSummary>('/incidents', {
          categoryId,
          buildingId,
          room: room.trim(),
          description: description.trim(),
          urgency,
          assistantInteractionId: prefill?.interactionId,
          attachmentKey,
        }),
      );
      if (user) {
        try {
          localStorage.removeItem(draftKey(user.id));
        } catch {
          // rien à faire
        }
      }
      // Le pré-remplissage vit dans l'historique du navigateur : on l'efface pour qu'un rechargement ne le réapplique pas.
      if (prefill) navigate(location.pathname, { replace: true, state: null });
      window.scrollTo({ top: 0 });
    } catch (err) {
      if (err instanceof ApiRequestError) setErrors({ ...err.fields, _: err.message });
      else setErrors({ _: t('Envoi impossible, réessayez.', 'Could not send, please try again.') });
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    return (
      <section className="card confirm" aria-live="polite">
        <CircleCheck className="confirm__icon" size={40} strokeWidth={1.75} aria-hidden="true" />
        <h1>{t('Signalement envoyé', 'Report sent')}</h1>
        <p>
          {t('Numéro de ticket', 'Ticket number')} <strong className="confirm__number">{created.ticketNumber}</strong>
        </p>
        <p>
          {t('Statut :', 'Status:')} <StatusBadge status={created.status} />
        </p>
        {created.priority === 'CRITIQUE' && (
          <p className="alert alert--warning">
            {t("Incident de sécurité : l'administration a été alertée immédiatement.", 'Safety incident: the administration has been alerted immediately.')}
          </p>
        )}
        <p className="muted">{t('Vous pouvez suivre son avancement dans « Mes signalements ».', 'You can follow its progress in “My reports”.')}</p>
        <div className="actions">
          <Link to={`/etudiant/tickets/${created.id}`} className="btn btn--primary">
            {t('Voir le ticket', 'View ticket')}
          </Link>
          <Link to="/etudiant" className="btn btn--secondary">
            {t('Mes signalements', 'My reports')}
          </Link>
        </div>
      </section>
    );
  }

  const req = (
    <span className="req" aria-hidden="true">
      *
    </span>
  );

  return (
    <section className="report">
      <h1>{t('Signaler un incident', 'Report an incident')}</h1>
      {prefill && (
        <p className="alert alert--info">
          {t("Formulaire pré-rempli par l'assistant : vérifiez et complétez avant d'envoyer.", 'Form pre-filled by the assistant: check and complete it before sending.')}
        </p>
      )}
      {refsError && <p className="alert alert--error">{refsError.message}</p>}
      {draftRestored && (
        <div className="alert alert--info draft-banner" role="status">
          <span>
            {t('Brouillon restauré. La photo n’est pas conservée dans le brouillon.', 'Draft restored. The photo is not kept in drafts.')}
          </span>
          <button type="button" className="btn btn--quiet btn--sm" onClick={clearDraft}>
            {t('Effacer le brouillon', 'Discard draft')}
          </button>
        </div>
      )}

      <form className="form card" onSubmit={onSubmit} noValidate>
        <fieldset className="field">
          <legend>
            {t("Type d'incident", 'Incident type')} {req}
          </legend>
          <div className="chips" role="radiogroup" aria-describedby={errors.categoryId ? 'e-categoryId' : undefined}>
            {refs?.categories.map((c, i) => (
              <label key={c.id} className={`chip ${categoryId === c.id ? 'chip--on' : ''}`}>
                <input
                  type="radio"
                  name="category"
                  id={i === 0 ? 'f-categoryId' : undefined}
                  value={c.id}
                  checked={categoryId === c.id}
                  onChange={() => changeCategory(c.id)}
                />
                <span className="chip__label">{category(c)}</span>
                <span className="chip__help">{t(c.description, c.descriptionEn || c.description)}</span>
              </label>
            ))}
          </div>
          {errors.categoryId && (
            <p id="e-categoryId" className="field__error">
              {errors.categoryId}
            </p>
          )}
          {selectedCategory?.autoPriority === 'CRITIQUE' && (
            <p className="alert alert--warning">
              {t("Priorité critique : l'administration sera alertée dès l'envoi.", 'Critical priority: the administration will be alerted as soon as you send.')}
            </p>
          )}
        </fieldset>

        <div className="row-2">
          <div className="field">
            <label htmlFor="f-buildingId">
              {t('Bâtiment', 'Building')} {req}
            </label>
            <select
              id="f-buildingId"
              value={buildingId}
              onChange={(e) => changeBuilding(e.target.value)}
              aria-invalid={!!errors.buildingId}
              aria-describedby={errors.buildingId ? 'e-buildingId' : undefined}
            >
              <option value="">{t('Choisir…', 'Choose…')}</option>
              {refs?.buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            {errors.buildingId && (
              <p id="e-buildingId" className="field__error">
                {errors.buildingId}
              </p>
            )}
          </div>
          <div className="field">
            <label htmlFor="f-room">
              {t('Salle ou lieu précis', 'Room or exact spot')} {req}
            </label>
            <input
              id="f-room"
              value={room}
              maxLength={SETTINGS.room.max}
              placeholder={t('ex. A102, hall, 2e étage', 'e.g. A102, hall, 2nd floor')}
              onChange={(e) => changeRoom(e.target.value)}
              aria-invalid={!!errors.room}
              aria-describedby={errors.room ? 'e-room' : undefined}
            />
            {errors.room && (
              <p id="e-room" className="field__error">
                {errors.room}
              </p>
            )}
          </div>
        </div>

        {similarShown.length > 0 && (
          <div className="alert alert--warning similar" role="status">
            <p>
              <strong>{t('Un incident similaire est déjà en cours de traitement :', 'A similar incident is already being handled:')}</strong>
            </p>
            <ul>
              {similarShown.map((x) => (
                <li key={x.ticketNumber}>
                  <strong>{x.ticketNumber}</strong> {x.title}, {label(STATUS_LABELS[x.status]).toLowerCase()}, {formatAgo(x.createdAt, lang)}
                </li>
              ))}
            </ul>
            <p className="similar__hint">
              {t('Vous pouvez tout de même envoyer votre signalement s’il s’agit d’un autre problème.', 'You can still send your report if it is a different problem.')}
            </p>
          </div>
        )}

        <div className="field">
          <label htmlFor="f-description">
            {t('Description', 'Description')} {req}
          </label>
          <textarea
            id="f-description"
            value={description}
            maxLength={SETTINGS.description.max}
            placeholder={t('Que se passe-t-il ? Depuis quand ?', 'What is happening? Since when?')}
            onChange={(e) => changeDescription(e.target.value)}
            aria-invalid={!!errors.description}
            aria-describedby={`h-description${errors.description ? ' e-description' : ''}`}
          />
          <p id="h-description" className="field__help">
            {description.trim().length}/{SETTINGS.description.max} {t('caractères', 'characters')}
          </p>
          {errors.description && (
            <p id="e-description" className="field__error">
              {errors.description}
            </p>
          )}
          {showSuggestion && (
            <div className="ai-suggest" role="status">
              <Bot size={18} strokeWidth={1.75} aria-hidden="true" />
              <span className="ai-suggest__text">
                {t('Suggestion de l’assistant :', 'Assistant suggestion:')} <strong>{category(suggestedCategory)}</strong>,{' '}
                {t('urgence', 'urgency')} {label(URGENCY_LABELS[suggestion.urgency]).toLowerCase()}
              </span>
              <button type="button" className="btn btn--secondary btn--sm" onClick={applySuggestion}>
                {t('Appliquer', 'Apply')}
              </button>
            </div>
          )}
        </div>

        <fieldset className="field">
          <legend>{t('Urgence ressentie', 'Perceived urgency')}</legend>
          <div className="segmented" role="radiogroup">
            {URGENCIES.map((u) => (
              <label key={u} className={`segmented__item ${urgency === u ? 'segmented__item--on' : ''}`}>
                <input type="radio" name="urgency" value={u} checked={urgency === u} onChange={() => setUrgency(u)} />
                {label(URGENCY_LABELS[u])}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="field">
          <label htmlFor="f-photo">{t('Photo ou document (facultatif)', 'Photo or document (optional)')}</label>
          {photo ? (
            <div className="photo-preview">
              {preview ? (
                <img src={preview} alt={t('Aperçu de la photo jointe', 'Preview of the attached photo')} />
              ) : (
                <span className="file-chip">
                  <FileText size={18} strokeWidth={1.75} aria-hidden="true" />
                  {photo.name}
                </span>
              )}
              <button type="button" className="btn btn--secondary btn--sm" onClick={removePhoto}>
                {t('Retirer la pièce jointe', 'Remove attachment')}
              </button>
            </div>
          ) : (
            <input
              id="f-photo"
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              onChange={onPhoto}
              aria-describedby={`h-photo${errors.photo ? ' e-photo' : ''}`}
            />
          )}
          <p id="h-photo" className="field__help">
            {t(`JPG, PNG ou PDF, ${SETTINGS.maxPhotoMb} Mo maximum.`, `JPG, PNG or PDF, ${SETTINGS.maxPhotoMb} MB max.`)}
          </p>
          {errors.photo && (
            <p id="e-photo" className="field__error">
              {errors.photo}
            </p>
          )}
        </div>

        <p className="notice" role="note">
          <ShieldCheck size={18} strokeWidth={1.75} aria-hidden="true" />
          {t(
            "Ne photographiez pas de personnes et n'indiquez pas de données personnelles dans la description.",
            'Do not photograph people and do not include personal data in the description.',
          )}
        </p>

        {errors._ && (
          <p className="alert alert--error" role="alert">
            {errors._}
          </p>
        )}
        <button type="submit" className="btn btn--primary btn--block" disabled={busy || !refs}>
          {busy ? t('Envoi…', 'Sending…') : t('Envoyer le signalement', 'Send report')}
        </button>
      </form>
    </section>
  );
}
