import { isLang, type SessionUser } from '@smartcampus/shared';
import type { PrismaClient } from '../db';
import type { AuthProvider } from '../ports/auth';
import { verifyPassword } from './password';

const select = { id: true, email: true, name: true, role: true, locale: true } as const;

function toSessionUser(u: { id: string; email: string; name: string; role: SessionUser['role']; locale: string }): SessionUser {
  return { id: u.id, email: u.email, name: u.name, role: u.role, locale: isLang(u.locale) ? u.locale : 'fr' };
}

/** SSO école simulé : comptes de démo en base. */
export class LocalAuthProvider implements AuthProvider {
  readonly name = 'local';

  constructor(private readonly prisma: PrismaClient) {}

  async authenticate(email: string, password: string): Promise<SessionUser | null> {
    const user = await this.prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!user || user.anonymizedAt || !(await verifyPassword(password, user.passwordHash))) return null;
    return toSessionUser(user);
  }

  async findUser(id: string): Promise<SessionUser | null> {
    const user = await this.prisma.user.findFirst({ where: { id, anonymizedAt: null }, select });
    return user ? toSessionUser(user) : null;
  }
}
