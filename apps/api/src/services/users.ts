import { bi, OPEN_STATUSES, type Role, type SessionUser } from '@smartcampus/shared';
import type { PrismaClient } from '../db';
import { ConflictError, NotFoundError } from '../domain/errors';
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
        await this.audit.log(actor, 'ROLE_CHANGE', { type: 'user', id: userId }, { email: user.email, from: user.role, to: role }, tx);
      });
    }
    const [row] = (await this.list(user.email)).filter((u) => u.id === userId);
    return row!;
  }
}
