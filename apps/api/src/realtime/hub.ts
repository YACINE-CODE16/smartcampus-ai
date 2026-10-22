import type { Response } from 'express';
import type { LiveEvent, Role, SessionUser } from '@smartcampus/shared';

interface Client {
  userId: string;
  role: Role;
  res: Response;
}

/**
 * Diffusion temps réel par Server-Sent Events (instance unique).
 * Les événements ne portent que des identifiants : le client recharge via l'API, qui applique R1.
 */
export class LiveHub {
  private readonly clients = new Set<Client>();

  attach(user: SessionUser, res: Response): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // pas de mise en tampon derrière un proxy
    });
    res.write('retry: 3000\n\n');
    const client = { userId: user.id, role: user.role, res };
    this.clients.add(client);
    const ping = setInterval(() => res.write(': ping\n\n'), 25_000);
    res.on('close', () => {
      clearInterval(ping);
      this.clients.delete(client);
    });
  }

  toUsers(userIds: (string | null | undefined)[], event: LiveEvent): void {
    const ids = new Set(userIds.filter(Boolean));
    this.send((c) => ids.has(c.userId), event);
  }

  toRoles(roles: Role[], event: LiveEvent): void {
    this.send((c) => roles.includes(c.role), event);
  }

  get size(): number {
    return this.clients.size;
  }

  private send(match: (c: Client) => boolean, event: LiveEvent): void {
    const frame = `data: ${JSON.stringify(event)}\n\n`;
    for (const c of this.clients) if (match(c)) c.res.write(frame);
  }
}
