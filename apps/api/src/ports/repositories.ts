import type {
  AssistantConversation,
  Category,
  Incident,
  IncidentEvent,
  IncidentStatus,
  Notification,
  Rating,
  Urgency,
} from '@smartcampus/shared';

/**
 * Accès aux données, une interface par agrégat.
 * - local : Prisma + SQLite.
 * - aws (phase 9) : DynamoDB via Amplify Data (AppSync) — écrire via AppSync déclenche
 *   les subscriptions temps réel.
 * Les signatures sont volontairement simples (pas de jointures) pour rester
 * transposables à DynamoDB.
 */

export type NewIncident = Omit<
  Incident,
  'id' | 'trackingNumber' | 'createdAt' | 'updatedAt' | 'resolvedAt' | 'closedAt' | 'anonymizedAt'
>;

export type IncidentPatch = Partial<
  Pick<
    Incident,
    | 'status'
    | 'urgency'
    | 'assignedToId'
    | 'assignedToName'
    | 'technicianComment'
    | 'resolvedAt'
    | 'closedAt'
    | 'description'
    | 'photoKey'
    | 'ownerId'
    | 'ownerName'
    | 'anonymizedAt'
  >
>;

/** Préconditions d'une écriture conditionnelle (anti-doublon « prendre en charge »). */
export interface IncidentExpectation {
  status?: IncidentStatus;
  assignedToId?: string | null;
}

export interface IncidentFilters {
  ownerId?: string;
  assignedToId?: string | null;
  statuses?: IncidentStatus[];
  categoryId?: string;
  building?: string;
  urgency?: Urgency;
  createdAfter?: string;
}

export interface IncidentRepository {
  create(data: NewIncident): Promise<Incident>;
  findById(id: string): Promise<Incident | null>;
  list(filters?: IncidentFilters): Promise<Incident[]>;
  /** Lève `ConflictError` si `expected` n'est plus vrai au moment de l'écriture. */
  update(id: string, patch: IncidentPatch, expected?: IncidentExpectation): Promise<Incident>;
}

export interface IncidentEventRepository {
  create(data: Omit<IncidentEvent, 'id' | 'createdAt'>): Promise<IncidentEvent>;
  listByIncident(incidentId: string): Promise<IncidentEvent[]>;
}

export interface RatingRepository {
  create(data: Omit<Rating, 'id' | 'createdAt'>): Promise<Rating>;
  findByIncident(incidentId: string): Promise<Rating | null>;
  list(filters?: { createdAfter?: string }): Promise<Rating[]>;
}

export interface ConversationRepository {
  create(data: Omit<AssistantConversation, 'id' | 'createdAt'>): Promise<AssistantConversation>;
  findById(id: string): Promise<AssistantConversation | null>;
  update(
    id: string,
    patch: Partial<Pick<AssistantConversation, 'messages' | 'helpful' | 'ticketCreated' | 'incidentId'>>,
  ): Promise<AssistantConversation>;
  /** Pour les statistiques agrégées : jamais exposé tel quel à l'admin. */
  list(filters?: { createdAfter?: string }): Promise<AssistantConversation[]>;
}

export interface NotificationRepository {
  create(data: Omit<Notification, 'id' | 'createdAt' | 'read'>): Promise<Notification>;
  listByUser(userId: string, options?: { unreadOnly?: boolean }): Promise<Notification[]>;
  markRead(id: string, userId: string): Promise<void>;
  markAllRead(userId: string): Promise<void>;
}

export interface CategoryRepository {
  list(options?: { activeOnly?: boolean }): Promise<Category[]>;
  findById(id: string): Promise<Category | null>;
  create(data: Omit<Category, 'id'>): Promise<Category>;
  update(id: string, patch: Partial<Omit<Category, 'id'>>): Promise<Category>;
}

export interface Repositories {
  incidents: IncidentRepository;
  incidentEvents: IncidentEventRepository;
  ratings: RatingRepository;
  conversations: ConversationRepository;
  notifications: NotificationRepository;
  categories: CategoryRepository;
}

/**
 * Exécute plusieurs écritures de façon atomique (incident + événement + notification).
 * local : transaction Prisma. aws : TransactWriteItems DynamoDB.
 */
export interface UnitOfWork {
  run<T>(work: (repos: Repositories) => Promise<T>): Promise<T>;
}
