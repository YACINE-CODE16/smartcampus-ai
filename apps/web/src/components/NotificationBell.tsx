import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { notificationText, type NotificationDto, type NotificationList, type Role } from '@smartcampus/shared';
import { api } from '../lib/api';
import { formatAgo } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { useLive } from '../lib/live';

const TICKET_PATH: Record<Role, string> = {
  STUDENT: '/etudiant/tickets',
  AGENT: '/agent/tickets',
  ADMIN: '/admin/tickets',
};

/** US-10 : cloche + compteur de notifications non lues, mis à jour en temps réel. */
export function NotificationBell({ role }: { role: Role }) {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<NotificationList | null>(null);
  const panel = useRef<HTMLDivElement>(null);

  const load = () => api.get<NotificationList>('/notifications').then(setData).catch(() => undefined);
  useEffect(() => {
    void load();
  }, []);
  useLive((e) => {
    if (e.type !== 'notification') return;
    setData((d) => (d ? { ...d, unread: e.unread } : d));
    if (open || e.unread > (data?.unread ?? 0)) void load();
  });

  // Fermeture au clic extérieur et à Échap.
  useEffect(() => {
    if (!open) return;
    const onClick = (ev: MouseEvent) => panel.current && !panel.current.contains(ev.target as Node) && setOpen(false);
    const onKey = (ev: KeyboardEvent) => ev.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function openItem(n: NotificationDto) {
    setOpen(false);
    if (!n.read) {
      const r = await api.post<{ unread: number }>(`/notifications/${n.id}/read`).catch(() => null);
      setData((d) => (d ? { unread: r?.unread ?? d.unread, items: d.items.map((x) => (x.id === n.id ? { ...x, read: true } : x)) } : d));
    }
    if (n.incidentId) navigate(`${TICKET_PATH[role]}/${n.incidentId}`);
  }

  async function readAll() {
    await api.post('/notifications/read-all').catch(() => undefined);
    void load();
  }

  const unread = data?.unread ?? 0;
  return (
    <div className="bell" ref={panel}>
      <button
        type="button"
        className="bell__btn"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={t(`Notifications, ${unread} non lue(s)`, `Notifications, ${unread} unread`)}
        onClick={() => {
          setOpen((o) => !o);
          void load();
        }}
      >
        🔔{unread > 0 && <span className="bell__count">{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && (
        <div className="bell__panel" role="dialog" aria-label={t('Notifications', 'Notifications')}>
          <div className="bell__head">
            <strong>{t('Notifications', 'Notifications')}</strong>
            {unread > 0 && (
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => void readAll()}>
                {t('Tout marquer comme lu', 'Mark all as read')}
              </button>
            )}
          </div>
          {data && data.items.length === 0 && <p className="muted bell__empty">{t('Aucune notification.', 'No notifications.')}</p>}
          <ul className="bell__list">
            {data?.items.map((n) => {
              const text = notificationText(n.type, n.params, lang);
              return (
                <li key={n.id}>
                  <button type="button" className={`bell__item ${n.read ? '' : 'bell__item--unread'}`} onClick={() => void openItem(n)}>
                    <span className="bell__title">{text.title}</span>
                    {text.body && <span className="bell__body">{text.body}</span>}
                    <span className="bell__time">{formatAgo(n.createdAt, lang)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
