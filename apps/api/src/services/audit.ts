import type { SessionUser } from '@smartcampus/shared';
import type { PrismaClient } from '../db';
import type { AuditAction, Prisma } from '../generated/prisma/client';

type Tx = Pick<PrismaClient, 'auditLog'>;

/** US-37 : journal des actions sensibles, en ajout seul (aucune modification ni suppression exposée). */
export class AuditService {
  constructor(private readonly prisma: PrismaClient) {}

  log(
    actor: SessionUser,
    action: AuditAction,
    target: { type: string; id: string },
    details: Prisma.InputJsonObject = {},
    tx: Tx = this.prisma,
  ) {
    return tx.auditLog.create({
      data: { actorId: actor.id, actorRole: actor.role, action, targetType: target.type, targetId: target.id, details },
    });
  }
}
