import { useState, type ReactNode } from 'react';
import { ROLE_LABELS, ROLES, type Role } from '@smartcampus/shared';
import { ApiRequestError, api, query } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { useApi } from '../../lib/useApi';

export interface UserRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  anonymized: boolean;
  tickets: number;
}

/** Ligne utilisateur : changement de rôle (US-02) et emplacement des actions RGPD (US-34). */
function UserLine({ u, self, onChanged, extra }: { u: UserRow; self: boolean; onChanged(): void; extra?: (u: UserRow) => ReactNode }) {
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
      {extra && <td>{extra(u)}</td>}
    </tr>
  );
}

/** US-02 : comptes et rôles (attribution réservée à l'administration, tracée dans le journal d'audit). */
export function UsersPage({ extra }: { extra?: (u: UserRow, reload: () => void) => ReactNode }) {
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
        <div className="card table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">{t('Utilisateur', 'User')}</th>
                <th scope="col">{t('Tickets', 'Tickets')}</th>
                <th scope="col">{t('Rôle', 'Role')}</th>
                {extra && <th scope="col">{t('Données personnelles', 'Personal data')}</th>}
              </tr>
            </thead>
            <tbody>
              {data.map((u) => (
                <UserLine key={u.id} u={u} self={u.id === user?.id} onChanged={reload} extra={extra ? (x) => extra(x, reload) : undefined} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
