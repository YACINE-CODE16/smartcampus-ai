import type { Role } from '@smartcampus/shared';

/** À qui envoyer un événement. Le contenu ne part jamais à quelqu'un qui n'a pas le droit de le lire. */
export type Audience = { userIds: string[] } | { role: Role };

export type RealtimeEvent =
  | { type: 'incident.changed'; incidentId: string }
  | { type: 'queue.changed'; incidentId: string }
  | { type: 'notification.created'; notificationId: string };

/**
 * Diffusion temps réel. Les événements ne portent que des identifiants : le client
 * recharge ensuite la ressource via l'API, qui applique les droits d'accès.
 * - local : Server-Sent Events (`GET /api/events`).
 * - aws (phase 9) : subscriptions AppSync (Amplify Data).
 */
export interface RealtimePublisher {
  readonly name: string;
  publish(audience: Audience, event: RealtimeEvent): Promise<void>;
}
