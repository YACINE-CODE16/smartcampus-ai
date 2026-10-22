import type { SessionUser } from '@smartcampus/shared';
import type { PrismaClient } from '../db';
import type { AuthProvider } from '../ports/auth';
import { verifyPassword } from './password';

const select = { id: true, email: true, name: true, role: true } as const;

/** SSO école simulé : comptes de démo en base. */
export class LocalAuthProvider implements AuthProvider {
  readonly name = 'local';

  constructor(private readonly prisma: PrismaClient) {}

  async authenticate(email: string, password: string): Promise<SessionUser | null> {
    const user = await this.prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!user || !(await verifyPassword(password, user.passwordHash))) return null;
    return { id: user.id, email: user.email, name: user.name, role: user.role };
  }

  findUser(id: string): Promise<SessionUser | null> {
    return this.prisma.user.findUnique({ where: { id }, select });
  }
}
