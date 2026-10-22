import type { Lang } from '../config/i18n';
import type { ActorRole, Role } from '../config/roles';
import type { NotificationParams, NotificationType } from '../domain/notifications';
import type { IncidentStatus } from '../config/statuses';
import type { Priority, Urgency } from '../config/urgencies';

/** Contrats HTTP partagés entre l'API et le front. Dates en ISO 8601. */

export type ISODate = string;

export interface HealthResponse {
  status: 'ok' | 'degraded';
  version: string;
  database: 'ok' | 'error';
  /** Implémentation active de chaque port (ex. `{ storage: 'local', ai: 'mock' }`). */
  adapters: Record<string, string>;
}

export interface ApiError {
  error: string;
  message: string;
  /** Erreurs par champ (validation). */
  fields?: Record<string, string>;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  locale: Lang;
}

export interface DemoAccount {
  email: string;
  name: string;
  role: Role;
}

export interface CategoryDto {
  id: string;
  slug: string;
  label: string;
  labelEn: string;
  description: string;
  descriptionEn: string;
  autoPriority: Priority | null;
  /** Délai cible de prise en charge en heures (US-18). */
  targetHours: number;
}

/** Libellé de catégorie dans une langue donnée. */
export interface CategoryRef {
  id: string;
  label: string;
  labelEn: string;
}

export interface BuildingDto {
  id: string;
  code: string;
  name: string;
}

export interface Referentials {
  categories: CategoryDto[];
  buildings: BuildingDto[];
}

export interface PersonRef {
  id: string;
  name: string;
}

export interface IncidentSummary {
  id: string;
  number: number;
  /** `SC-0001` */
  ticketNumber: string;
  title: string;
  status: IncidentStatus;
  urgency: Urgency;
  priority: Priority;
  category: CategoryRef;
  building: { id: string; name: string };
  room: string;
  owner: PersonRef;
  assignedTo: PersonRef | null;
  hasPhoto: boolean;
  isLate: boolean;
  reopenCount: number;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface IncidentEventDto {
  id: string;
  type: 'CREATED' | 'STATUS' | 'ASSIGN' | 'UPDATE' | 'MERGE';
  fromStatus: IncidentStatus | null;
  toStatus: IncidentStatus | null;
  comment: string | null;
  author: PersonRef | null;
  authorRole: ActorRole;
  createdAt: ISODate;
}

export interface RatingDto {
  score: number;
  comment: string | null;
  createdAt: ISODate;
}

export interface IncidentDetail extends IncidentSummary {
  description: string;
  rejectionReason: string | null;
  mergedInto: { id: string; ticketNumber: string } | null;
  rating: RatingDto | null;
  takenAt: ISODate | null;
  resolvedAt: ISODate | null;
  closedAt: ISODate | null;
  events: IncidentEventDto[];
}

export interface IncidentListQuery {
  /** `unassigned` : file des tickets non affectés (agents, admin). `mine` : affectés à moi (agents). */
  scope?: 'mine' | 'unassigned';
  status?: IncidentStatus;
  categoryId?: string;
  buildingId?: string;
  assignedToId?: string;
  priority?: Priority;
  /** Uniquement les tickets en retard (US-18). */
  late?: boolean;
  /** Recherche dans le numéro, le titre et la salle (US-27). */
  q?: string;
  /** Période de création (ISO, US-27). */
  from?: ISODate;
  to?: ISODate;
}

export interface InternalNoteDto {
  id: string;
  body: string;
  author: PersonRef;
  createdAt: ISODate;
}

export interface NotificationDto {
  id: string;
  type: NotificationType;
  incidentId: string | null;
  params: NotificationParams;
  read: boolean;
  createdAt: ISODate;
}

export interface NotificationList {
  items: NotificationDto[];
  unread: number;
}

export interface AgentDto {
  id: string;
  name: string;
  email: string;
  /** Tickets ouverts affectés (US-13, US-33). */
  openCount: number;
}

export interface AlertsResponse {
  /** Tickets critiques ouverts (R3). */
  critical: IncidentSummary[];
  /** Tickets au-delà du délai cible (US-18). */
  late: IncidentSummary[];
}

/** Événements temps réel (SSE) : identifiants uniquement, le client recharge via l'API. */
export type LiveEvent =
  | { type: 'incident.changed'; id: string }
  | { type: 'notification'; unread: number }
  | { type: 'alert'; kind: 'critical' | 'late'; id: string };
