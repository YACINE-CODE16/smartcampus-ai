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
  /** Début de la description (110 caractères), pour reconnaître un ticket dans une liste. */
  excerpt: string;
  status: IncidentStatus;
  urgency: Urgency;
  priority: Priority;
  category: CategoryRef;
  /** `code` : A, B, C, BIB, RU… affiché sur la plaque de lieu. */
  building: { id: string; name: string; code: string };
  room: string;
  owner: PersonRef;
  assignedTo: PersonRef | null;
  /** Pièce jointe présente (photo ou document, US-04). */
  hasPhoto: boolean;
  attachmentKind: 'image' | 'pdf' | null;
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
  /** Recherche dans le numéro, le titre et la salle (US-33). */
  q?: string;
  /** Période de création (ISO, US-33). */
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
  /** Tickets ouverts affectés (US-13, US-32). */
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

export const DASHBOARD_PERIODS = ['7d', '30d', '90d', 'all'] as const;
export type DashboardPeriod = (typeof DASHBOARD_PERIODS)[number];

/** US-27 à US-32 : données du tableau de bord pour une période. */
export interface DashboardResponse {
  period: DashboardPeriod;
  granularity: 'day' | 'week' | 'month' | 'year';
  from: ISODate;
  to: ISODate;
  kpis: {
    total: number;
    avgResolutionHours: number | null;
    resolutionRate: number | null;
    reopenRate: number | null;
    satisfaction: number | null;
    ratingsCount: number;
    /** État actuel (indépendant de la période). */
    openCritical: number;
    late: number;
  };
  byStatus: Record<IncidentStatus, number>;
  byCategory: { id: string; label: string; labelEn: string; count: number }[];
  byBuilding: { id: string; name: string; count: number }[];
  /** US-29 : salles les plus signalées (8 premières). */
  byRoom: { building: { code: string; name: string }; room: string; count: number }[];
  filters: { categoryId: string | null; buildingId: string | null };
  series: { bucket: string; created: number; resolved: number }[];
  agents: {
    id: string;
    name: string;
    open: number;
    critical: number;
    late: number;
    resolved: number;
    avgResolutionHours: number | null;
  }[];
  assistant: {
    questions: number;
    byKind: Record<string, number>;
    thumbsUp: number;
    thumbsDown: number;
    ticketsCreated: number;
    aiResolvedRate: number | null;
  };
}

/** Type de réponse de l'assistant (US-19 à US-26). */
export const ASSISTANT_KINDS = ['faq', 'document', 'ticket_status', 'needs_ticket', 'out_of_scope'] as const;
export type AssistantKind = (typeof ASSISTANT_KINDS)[number];

export interface AssistantSource {
  type: 'faq' | 'document';
  id: string;
  title: string;
}

/** Ticket proposé par l'assistant (US-21) ; l'étudiant valide toujours lui-même. */
export interface SuggestedTicket {
  categorySlug: string;
  buildingCode?: string;
  room?: string;
  description: string;
}

export interface AssistantReplyDto {
  interactionId: string;
  kind: AssistantKind;
  answer: string;
  sources: AssistantSource[];
  suggestedTicket?: SuggestedTicket;
  /** Tickets de l'utilisateur cités dans la réponse (US-22), pour afficher des liens. */
  tickets?: { id: string; ticketNumber: string }[];
  language: Lang;
}

export interface AssistantMessageInput {
  role: 'user' | 'assistant';
  content: string;
}

/** US-25 : suggestion de qualification. */
export interface TriageSuggestion {
  categorySlug: string;
  urgency: Urgency;
}

/** US-24 : base documentaire. */
export interface FaqEntryDto {
  id: string;
  question: string;
  answer: string;
  questionEn: string | null;
  answerEn: string | null;
  keywords: string[];
  topic: string;
}

export interface KbDocumentDto {
  id: string;
  title: string;
  content: string;
  language: Lang;
  updatedAt: ISODate;
}

/** US-37 : actions sensibles journalisées. */
export const AUDIT_ACTIONS = ['ROLE_CHANGE', 'REJECT', 'MERGE', 'DATA_DELETION', 'EXPORT'] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export interface AuditEntryDto {
  id: string;
  action: AuditAction;
  actor: PersonRef | null;
  actorRole: ActorRole;
  targetType: string;
  targetId: string;
  /** Nom actuel de l'utilisateur ciblé (« Utilisateur supprimé » après US-34). */
  targetLabel: string | null;
  details: Record<string, unknown>;
  createdAt: ISODate;
}
