import { bi, OPEN_STATUSES, type Role, type SessionUser } from '@smartcampus/shared';
import type { PrismaClient } from '../db';
import { ConflictError, NotFoundError, ValidationError } from '../domain/errors';
import type { FileStorage } from '../ports/file-storage';
import type { AuditService } from './audit';

export interface UserRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  anonymized: boolean;
  tickets: number;
}

/** US-02 (rôles) et US-34 (suppression des données) : administration des comptes. */
export class UserAdminService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly audit: AuditService,
    private readonly storage: FileStorage,
  ) {}

  async list(q?: string): Promise<UserRow[]> {
    const term = q?.trim();
    const users = await this.prisma.user.findMany({
      where: term ? { OR: [{ name: { contains: term, mode: 'insensitive' } }, { email: { contains: term, mode: 'insensitive' } }] } : {},
      orderBy: [{ role: 'desc' }, { name: 'asc' }],
      select: { id: true, name: true, email: true, role: true, anonymizedAt: true, _count: { select: { ownedIncidents: true } } },
    });
    return users.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, anonymized: u.anonymizedAt !== null, tickets: u._count.ownedIncidents }));
  }

  /**
   * US-02 : changement de rôle, effectif dès la requête suivante (le rôle est relu en base à chaque appel).
   * Garde-fous : pas sur soi-même, pas sur un compte anonymisé, pas sur un agent qui a encore des tickets ouverts.
   */
  async setRole(actor: SessionUser, userId: string, role: Role): Promise<UserRow> {
    if (actor.id === userId) throw new ConflictError(bi('Vous ne pouvez pas modifier votre propre rôle.', 'You cannot change your own role.'));
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError();
    if (user.anonymizedAt) throw new ConflictError(bi('Ce compte a été anonymisé.', 'This account has been anonymised.'));
    if (user.role !== role) {
      if (user.role === 'AGENT') {
        const open = await this.prisma.incident.count({ where: { assignedToId: userId, status: { in: [...OPEN_STATUSES] } } });
        if (open > 0) {
          throw new ConflictError(
            bi(`Réaffectez d’abord ses ${open} ticket(s) ouvert(s).`, `Reassign their ${open} open ticket(s) first.`),
          );
        }
      }
      await this.prisma.$transaction(async (tx) => {
        await tx.user.update({ where: { id: userId }, data: { role } });
        await this.audit.log(actor, 'ROLE_CHANGE', { type: 'user', id: userId }, { from: user.role, to: role }, tx);
      });
    }
    const [row] = (await this.list(user.email)).filter((u) => u.id === userId);
    return row!;
  }

  /**
   * US-34 : suppression des données personnelles d'un étudiant sur demande (D19).
   * Le compte est anonymisé (plus de connexion possible) ; ses tickets restent pour les statistiques
   * mais sans description, photo, commentaires ni nom. Notifications et échanges avec l'assistant sont supprimés.
   * Le journal d'audit ne conserve que l'identifiant technique et des compteurs (pas l'email).
   */
  async erase(actor: SessionUser, userId: string, confirmEmail: string) {
    if (actor.id === userId) throw new ConflictError(bi('Vous ne pouvez pas supprimer votre propre compte.', 'You cannot erase your own account.'));
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError();
    if (user.anonymizedAt) throw new ConflictError(bi('Ce compte est déjà anonymisé.', 'This account is already anonymised.'));
    if (user.role !== 'STUDENT') {
      throw new ConflictError(bi('Seules les données d’un étudiant peuvent être supprimées ici.', 'Only a student’s data can be erased here.'));
    }
    if (confirmEmail.trim().toLowerCase() !== user.email) {
      throw new ValidationError(undefined, { confirmEmail: bi('Saisissez exactement l’email du compte', 'Type the account email exactly') });
    }

    const tickets = await this.prisma.incident.findMany({ where: { ownerId: userId }, select: { id: true, photoKey: true } });
    const ticketIds = tickets.map((t) => t.id);
    const photos = tickets.flatMap((t) => (t.photoKey ? [t.photoKey] : []));

    await this.prisma.$transaction(async (tx) => {
      await tx.incident.updateMany({
        where: { ownerId: userId },
        data: { description: ERASED_DESCRIPTION, photoKey: null },
      });
      await tx.incidentEvent.updateMany({ where: { authorId: userId }, data: { comment: null } });
      await tx.rating.updateMany({ where: { ownerId: userId }, data: { comment: null } });
      await tx.notification.deleteMany({ where: { userId } });
      await tx.assistantInteraction.deleteMany({ where: { userId } });
      await tx.user.update({
        where: { id: userId },
        data: {
          name: ERASED_NAME,
          email: `erased-${userId}@anonymized.invalid`,
          passwordHash: 'disabled',
          locale: 'fr',
          anonymizedAt: new Date(),
        },
      });
      await this.audit.log(actor, 'DATA_DELETION', { type: 'user', id: userId }, { tickets: ticketIds.length, photos: photos.length }, tx);
    });

    // Fichiers supprimés après la transaction : un échec de stockage ne réintroduit pas de données en base.
    await Promise.all(photos.map((key) => this.storage.delete(key).catch((err: unknown) => console.error('[rgpd] photo non supprimée :', key, err))));
    return { tickets: ticketIds.length, photos: photos.length };
  }
}

export const ERASED_NAME = 'Utilisateur supprimé';
export const ERASED_DESCRIPTION = bi('[Données supprimées à la demande de l’étudiant]', '[Data erased at the student’s request]');
