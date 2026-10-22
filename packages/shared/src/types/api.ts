import type { ActorRole, Role } from '../config/roles';
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
  description: string;
  autoPriority: Priority | null;
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
  category: { id: string; label: string };
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
  type: 'CREATED' | 'STATUS' | 'ASSIGN' | 'UPDATE';
  fromStatus: IncidentStatus | null;
  toStatus: IncidentStatus | null;
  comment: string | null;
  author: PersonRef | null;
  authorRole: ActorRole;
  createdAt: ISODate;
}

export interface IncidentDetail extends IncidentSummary {
  description: string;
  rejectionReason: string | null;
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
}
