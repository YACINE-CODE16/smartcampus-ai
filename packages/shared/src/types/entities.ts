import type { ActorRole, Role } from '../config/roles';
import type { IncidentStatus } from '../config/statuses';
import type { Urgency } from '../config/urgencies';

/**
 * Entités métier, communes au front, à l'API et aux adapters.
 * Dates en ISO 8601 (string) : même format en SQLite, en JSON et dans DynamoDB/AppSync.
 * Les champs marqués « dénormalisé » sont des copies d'affichage (choix D9).
 */

export type ISODateString = string;

export interface User {
  id: string;
  email: string;
  name: string;
  roles: Role[];
  emailVerified: boolean;
  createdAt: ISODateString;
}

export interface Incident {
  id: string;
  /** Choix D3 : `SC-` + 8 premiers caractères de l'id. */
  trackingNumber: string;
  title: string;
  categoryId: string;
  categoryLabel: string; // dénormalisé
  building: string;
  room: string;
  description: string;
  photoKey: string | null;
  urgency: Urgency;
  status: IncidentStatus;
  ownerId: string;
  ownerName: string; // dénormalisé
  assignedToId: string | null;
  assignedToName: string | null; // dénormalisé
  technicianComment: string | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  resolvedAt: ISODateString | null;
  closedAt: ISODateString | null;
  anonymizedAt: ISODateString | null;
}

export const INCIDENT_EVENT_TYPES = ['CREATED', 'STATUS', 'ASSIGN', 'URGENCY', 'COMMENT'] as const;
export type IncidentEventType = (typeof INCIDENT_EVENT_TYPES)[number];

export interface IncidentEvent {
  id: string;
  incidentId: string;
  type: IncidentEventType;
  fromStatus: IncidentStatus | null;
  toStatus: IncidentStatus;
  comment: string | null;
  authorId: string | null; // null pour SYSTEM
  authorName: string; // dénormalisé
  authorRole: ActorRole;
  createdAt: ISODateString;
}

export interface Rating {
  id: string;
  incidentId: string;
  ownerId: string;
  score: 1 | 2 | 3 | 4 | 5;
  comment: string | null;
  createdAt: ISODateString;
}

export interface AssistantMessage {
  role: 'user' | 'assistant';
  content: string;
  createdAt: ISODateString;
}

export interface AssistantConversation {
  id: string;
  ownerId: string;
  messages: AssistantMessage[];
  helpful: boolean | null;
  ticketCreated: boolean;
  incidentId: string | null;
  createdAt: ISODateString;
}

export const NOTIFICATION_TYPES = ['ASSIGNED', 'STATUS_CHANGED', 'RATING_REQUESTED'] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  incidentId: string;
  title: string;
  read: boolean;
  createdAt: ISODateString;
}

export interface Category {
  id: string;
  label: string;
  description: string | null;
  active: boolean;
  order: number;
}
