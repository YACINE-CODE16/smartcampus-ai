import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router';
import {
  SETTINGS,
  STATUS_LABELS,
  URGENCIES,
  URGENCY_LABELS,
  type IncidentSummary,
  type Referentials,
  type Urgency,
} from '@smartcampus/shared';
import { ApiRequestError, api } from '../../lib/api';
import { useApi } from '../../lib/useApi';

/** Valeurs de pré-remplissage (US-21 : envoyées par l'assistant via le state de navigation). */
export interface ReportPrefill {
  categorySlug?: string;
  buildingCode?: string;
  room?: string;
  description?: string;
}

type Errors = Partial<Record<'categoryId' | 'buildingId' | 'room' | 'description' | 'photo' | '_', string>>;

const MAX_BYTES = SETTINGS.maxPhotoMb * 1024 * 1024;
const PHOTO_ERROR = `Photo JPG ou PNG de ${SETTINGS.maxPhotoMb} Mo maximum`;

function validate(v: { categoryId: string; buildingId: string; room: string; description: string }): Errors {
  const e: Errors = {};
  if (!v.categoryId) e.categoryId = 'Choisissez un type';
  if (!v.buildingId) e.buildingId = 'Choisissez un bâtiment';
  if (!v.room.trim()) e.room = 'La salle est obligatoire';
  const d = v.description.trim();
  if (!d) e.description = 'La description est obligatoire';
  else if (d.length < SETTINGS.description.min) e.description = `Au moins ${SETTINGS.description.min} caractères`;
  return e;
}

/** US-03 / US-04 / US-05 : signaler un incident. */
export function ReportPage() {
  const prefill = (useLocation().state as { prefill?: ReportPrefill } | null)?.prefill;
  const { data: refs, error: refsError } = useApi<Referentials>('/referentials');

  // `null` = pas encore choisi : on retombe alors sur la valeur pré-remplie (si elle existe).
  const [chosenCategoryId, setCategoryId] = useState<string | null>(null);
  const [chosenBuildingId, setBuildingId] = useState<string | null>(null);
  const [room, setRoom] = useState(prefill?.room ?? '');
  const [description, setDescription] = useState(prefill?.description ?? '');
  const [urgency, setUrgency] = useState<Urgency>('NORMALE');
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<IncidentSummary | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Pré-remplissage par slug/code, résolu dès que les référentiels sont chargés.
  const categoryId = chosenCategoryId ?? refs?.categories.find((c) => c.slug === prefill?.categorySlug)?.id ?? '';
  const buildingId = chosenBuildingId ?? refs?.buildings.find((b) => b.code === prefill?.buildingCode)?.id ?? '';

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  const selectedCategory = refs?.categories.find((c) => c.id === categoryId);

  /** Efface l'erreur d'un champ dès que l'utilisateur le corrige. */
  function edit<T>(field: keyof Errors, setter: (v: T) => void) {
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
      setErrors((e) => ({ ...e, photo: PHOTO_ERROR }));
      ev.target.value = '';
      return;
    }
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
  }

  function removePhoto() {
    setPhoto(null);
    setPreview(null);
    if (fileInput.current) fileInput.current.value = '';
  }

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    const clientErrors = validate({ categoryId, buildingId, room, description });
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length) {
      document.getElementById(`f-${Object.keys(clientErrors)[0]}`)?.focus();
      return;
    }
    const form = new FormData();
    form.set('categoryId', categoryId);
    form.set('buildingId', buildingId);
    form.set('room', room.trim());
    form.set('description', description.trim());
    form.set('urgency', urgency);
    if (photo) form.set('photo', photo);

    setBusy(true);
    try {
      setCreated(await api.post<IncidentSummary>('/incidents', form));
      window.scrollTo({ top: 0 });
    } catch (err) {
      if (err instanceof ApiRequestError) setErrors({ ...err.fields, _: err.message });
      else setErrors({ _: 'Envoi impossible, réessayez.' });
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    return (
      <section className="card confirm" aria-live="polite">
        <p className="confirm__icon" aria-hidden="true">✓</p>
        <h1>Signalement envoyé</h1>
        <p>
          Numéro de ticket <strong className="confirm__number">{created.ticketNumber}</strong>
        </p>
        <p>
          Statut : <span className="badge badge--nouveau">{STATUS_LABELS[created.status]}</span>
        </p>
        {created.priority === 'CRITIQUE' && (
          <p className="alert alert--warning">Incident de sécurité : l'administration a été alertée immédiatement.</p>
        )}
        <p className="muted">Vous pouvez suivre son avancement dans « Mes signalements ».</p>
        <div className="actions">
          <Link to={`/etudiant/tickets/${created.id}`} className="btn btn--primary">
            Voir le ticket
          </Link>
          <Link to="/etudiant" className="btn btn--secondary">
            Mes signalements
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="report">
      <h1>Signaler un incident</h1>
      {prefill && <p className="alert alert--info">Formulaire pré-rempli par l'assistant : vérifiez et complétez avant d'envoyer.</p>}
      {refsError && <p className="alert alert--error">{refsError.message}</p>}

      <form className="form card" onSubmit={onSubmit} noValidate>
        <fieldset className="field">
          <legend>
            Type d'incident <span className="req" aria-hidden="true">*</span>
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
                <span className="chip__label">{c.label}</span>
                <span className="chip__help">{c.description}</span>
              </label>
            ))}
          </div>
          {errors.categoryId && <p id="e-categoryId" className="field__error">{errors.categoryId}</p>}
          {selectedCategory?.autoPriority === 'CRITIQUE' && (
            <p className="alert alert--warning">Priorité critique : l'administration sera alertée dès l'envoi.</p>
          )}
        </fieldset>

        <div className="row-2">
          <div className="field">
            <label htmlFor="f-buildingId">
              Bâtiment <span className="req" aria-hidden="true">*</span>
            </label>
            <select
              id="f-buildingId"
              value={buildingId}
              onChange={(e) => changeBuilding(e.target.value)}
              aria-invalid={!!errors.buildingId}
              aria-describedby={errors.buildingId ? 'e-buildingId' : undefined}
            >
              <option value="">Choisir…</option>
              {refs?.buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            {errors.buildingId && <p id="e-buildingId" className="field__error">{errors.buildingId}</p>}
          </div>
          <div className="field">
            <label htmlFor="f-room">
              Salle ou lieu précis <span className="req" aria-hidden="true">*</span>
            </label>
            <input
              id="f-room"
              value={room}
              maxLength={SETTINGS.room.max}
              placeholder="ex. A102, hall, 2e étage"
              onChange={(e) => changeRoom(e.target.value)}
              aria-invalid={!!errors.room}
              aria-describedby={errors.room ? 'e-room' : undefined}
            />
            {errors.room && <p id="e-room" className="field__error">{errors.room}</p>}
          </div>
        </div>

        <div className="field">
          <label htmlFor="f-description">
            Description <span className="req" aria-hidden="true">*</span>
          </label>
          <textarea
            id="f-description"
            value={description}
            maxLength={SETTINGS.description.max}
            placeholder="Que se passe-t-il ? Depuis quand ?"
            onChange={(e) => changeDescription(e.target.value)}
            aria-invalid={!!errors.description}
            aria-describedby={`h-description${errors.description ? ' e-description' : ''}`}
          />
          <p id="h-description" className="field__help">
            {description.trim().length}/{SETTINGS.description.max} caractères
          </p>
          {errors.description && <p id="e-description" className="field__error">{errors.description}</p>}
        </div>

        <fieldset className="field">
          <legend>Urgence ressentie</legend>
          <div className="segmented" role="radiogroup">
            {URGENCIES.map((u) => (
              <label key={u} className={`segmented__item ${urgency === u ? 'segmented__item--on' : ''}`}>
                <input type="radio" name="urgency" value={u} checked={urgency === u} onChange={() => setUrgency(u)} />
                {URGENCY_LABELS[u]}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="field">
          <label htmlFor="f-photo">Photo (facultative)</label>
          {preview ? (
            <div className="photo-preview">
              <img src={preview} alt="Aperçu de la photo jointe" />
              <button type="button" className="btn btn--secondary btn--sm" onClick={removePhoto}>
                Retirer la photo
              </button>
            </div>
          ) : (
            <input
              id="f-photo"
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png"
              onChange={onPhoto}
              aria-describedby={`h-photo${errors.photo ? ' e-photo' : ''}`}
            />
          )}
          <p id="h-photo" className="field__help">
            JPG ou PNG, {SETTINGS.maxPhotoMb} Mo maximum.
          </p>
          {errors.photo && <p id="e-photo" className="field__error">{errors.photo}</p>}
        </div>

        <p className="notice" role="note">
          🔒 Ne photographiez pas de personnes et n'indiquez pas de données personnelles dans la description.
        </p>

        {errors._ && (
          <p className="alert alert--error" role="alert">
            {errors._}
          </p>
        )}
        <button type="submit" className="btn btn--primary btn--block" disabled={busy || !refs}>
          {busy ? 'Envoi…' : 'Envoyer le signalement'}
        </button>
      </form>
    </section>
  );
}
