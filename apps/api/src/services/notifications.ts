import {
  isLang,
  notificationText,
  type NotificationDto,
  type NotificationList,
  type NotificationParams,
  type NotificationType,
} from '@smartcampus/shared';
import type { PrismaClient } from '../db';
import type { Mailer } from '../ports/mailer';
import type { LiveHub } from '../realtime/hub';

/** US-10 : notification in-app (temps réel) + email dans la langue du destinataire. */
export class NotificationService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly mailer: Mailer,
    private readonly hub: LiveHub,
    private readonly appUrl: string,
  ) {}

  async notify(userId: string, type: NotificationType, incidentId: string | null, params: NotificationParams): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true, locale: true, anonymizedAt: true } });
    if (!user || user.anonymizedAt) return;
    await this.prisma.notification.create({ data: { userId, type, incidentId, params: { ...params } } });
    this.hub.toUsers([userId], { type: 'notification', unread: await this.unreadCount(userId) });

    const lang = isLang(user.locale) ? user.locale : 'fr';
    const { title, body } = notificationText(type, params, lang);
    const link = incidentId ? `\n\n${lang === 'en' ? 'Open SmartCampus' : 'Ouvrir SmartCampus'} : ${this.appUrl}/` : '';
    const footer = lang === 'en' ? '\n\n— SmartCampus AI (automatic message)' : '\n\n— SmartCampus AI (message automatique)';
    // L'email ne doit jamais faire échouer l'action métier (US-10, critère 3).
    this.mailer.send({ to: user.email, subject: `[SmartCampus] ${title}`, text: `${body}${link}${footer}` }).catch((err: unknown) => {
      console.error(`[email] échec d'envoi à ${user.email} :`, err instanceof Error ? err.message : err);
    });
  }

  async notifyAdmins(type: NotificationType, incidentId: string, params: NotificationParams): Promise<void> {
    const admins = await this.prisma.user.findMany({ where: { role: 'ADMIN', anonymizedAt: null }, select: { id: true } });
    await Promise.all(admins.map((a) => this.notify(a.id, type, incidentId, params)));
  }

  unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, read: false } });
  }

  async list(userId: string): Promise<NotificationList> {
    const [rows, unread] = await Promise.all([
      this.prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 30 }),
      this.unreadCount(userId),
    ]);
    const items: NotificationDto[] = rows.map((n) => ({
      id: n.id,
      type: n.type,
      incidentId: n.incidentId,
      params: n.params as unknown as NotificationParams,
      read: n.read,
      createdAt: n.createdAt.toISOString(),
    }));
    return { items, unread };
  }

  async markRead(userId: string, id?: string): Promise<number> {
    await this.prisma.notification.updateMany({ where: { userId, read: false, ...(id ? { id } : {}) }, data: { read: true } });
    const unread = await this.unreadCount(userId);
    this.hub.toUsers([userId], { type: 'notification', unread });
    return unread;
  }
}
