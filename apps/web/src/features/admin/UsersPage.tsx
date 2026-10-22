import { useState, type FormEvent } from 'react';
import { ROLE_LABELS, ROLES, type Role } from '@smartcampus/shared';
import { ApiRequestError, api, query } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { useApi } from '../../lib/useApi';
import { TableWrap } from '../../components/TableWrap';

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  anonymized: boolean;
  tickets: number;
}

/** US-34 : suppression des données d'un étudiant, confirmée par la saisie de son email. */
function EraseControl({ u, onDone }: { u: UserRow; onDone(): void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function erase(ev: FormEvent) {
    ev.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post(`/admin/users/${u.id}/erase`, { confirmEmail: email });
      onDone();
    } catch (err) {
      setError(err instanceof ApiRequestError ? (Object.values(err.fields)[0] ?? err.message) : t('Échec', 'Failed'));
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="btn btn--danger-outline btn--sm" onClick={() => setOpen(true)}>
        {t('Supprimer ses données', 'Erase their data')}
      </button>
    );
  }
  return (
    <form className="erase" onSubmit={erase}>
      <p className="erase__warn">
        {t(
          'Action irréversible : compte anonymisé, descriptions, photos, commentaires, notifications et échanges avec l’assistant supprimés. Les tickets restent dans les statistiques.',
          'Irreversible: account anonymised; descriptions, photos, comments, notifications and assistant exchanges deleted. Tickets remain in statistics.',
        )}
      </p>
      <label htmlFor={`erase-${u.id}`}>{t('Pour confirmer, saisissez l’email du compte :', 'To confirm, type the account email:')}</label>
      <input id={`erase-${u.id}`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" required />
      {error && <span className="field__error">{error}</span>}
      <div className="work__form-actions">
        <button type="submit" className="btn btn--danger btn--sm" disabled={busy || !email}>
          {t('Supprimer définitivement', 'Erase permanently')}
        </button>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setOpen(false)}>
          {t('Annuler', 'Cancel')}
        </button>
      </div>
    </form>
  );
}

/** Ligne utilisateur : changement de rôle (US-02) et suppression des données (US-34). */
function UserLine({ u, self, onChanged }: { u: UserRow; self: boolean; onChanged(): void }) {
  const { t, label } = useI18n();
  const [role, setRole] = useState<Role>(u.role);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save() {
    setMsg(null);
    try {
      await api.patch(`/admin/users/${u.id}/role`, { role });
      setMsg({ ok: true, text: t('Rôle mis à jour', 'Role updated') });
      onChanged();
    } catch (err) {
      setRole(u.role);
      setMsg({ ok: false, text: err instanceof ApiRequestError ? err.message : t('Échec', 'Failed') });
    }
  }

  return (
    <tr className={u.anonymized ? 'row--muted' : ''}>
      <th scope="row">
        {u.name}
        {self && <span className="tag">{t('vous', 'you')}</span>}
        <span className="cell-sub">{u.email}</span>
      </th>
      <td>{u.tickets}</td>
      <td>
        {u.anonymized ? (
          <span className="tag">{t('anonymisé', 'anonymised')}</span>
        ) : (
          <div className="role-edit">
            <label className="sr-only" htmlFor={`role-${u.id}`}>
              {t(`Rôle de ${u.name}`, `Role of ${u.name}`)}
            </label>
            <select id={`role-${u.id}`} value={role} disabled={self} onChange={(e) => setRole(e.target.value as Role)}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {label(ROLE_LABELS[r])}
                </option>
              ))}
            </select>
            {role !== u.role && (
              <button type="button" className="btn btn--secondary btn--sm" onClick={() => void save()}>
                {t('Enregistrer', 'Save')}
              </button>
            )}
          </div>
        )}
        {msg && <span className={msg.ok ? 'ok' : 'field__error'}>{msg.text}</span>}
      </td>
      <td>{u.role === 'STUDENT' && !u.anonymized && !self ? <EraseControl u={u} onDone={onChanged} /> : <span className="muted">—</span>}</td>
    </tr>
  );
}

/** US-02 : comptes et rôles (attribution réservée à l'administration, tracée dans le journal d'audit). */
export function UsersPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const { data, error, reload } = useApi<UserRow[]>(`/admin/users${query({ q })}`);

  return (
    <section className="users">
      <h1>{t('Utilisateurs et rôles', 'Users and roles')}</h1>
      <p className="muted">
        {t(
          'Le rôle s’applique dès la prochaine action de l’utilisateur. Chaque changement est tracé dans le journal d’audit.',
          'The role applies from the user’s next action. Every change is recorded in the audit log.',
        )}
      </p>
      <div className="field users__search">
        <label htmlFor="user-q">{t('Rechercher', 'Search')}</label>
        <input id="user-q" type="search" value={q} placeholder={t('Nom ou email', 'Name or email')} onChange={(e) => setQ(e.target.value)} />
      </div>
      {error && <p className="alert alert--error">{error.message}</p>}
      {data && (
        <TableWrap label={t('Utilisateurs', 'Users')}>
          <table className="table">
            <thead>
              <tr>
                <th scope="col">{t('Utilisateur', 'User')}</th>
                <th scope="col">{t('Tickets', 'Tickets')}</th>
                <th scope="col">{t('Rôle', 'Role')}</th>
                <th scope="col">{t('Données personnelles (RGPD)', 'Personal data (GDPR)')}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((u) => (
                <UserLine key={u.id} u={u} self={u.id === user?.id} onChanged={reload} />
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
    </section>
  );
}
