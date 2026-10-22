/**
 * Erreurs métier, indépendantes du transport. La couche HTTP les traduit en codes.
 */
export class DomainError extends Error {
  constructor(
    readonly code: 'VALIDATION' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT',
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, fields?: Record<string, string>) {
    super('VALIDATION', message, fields);
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message = 'Authentification requise.') {
    super('UNAUTHORIZED', message);
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = 'Accès refusé.') {
    super('FORBIDDEN', message);
  }
}

/** Utilisé aussi pour un ticket existant mais non autorisé : on ne révèle pas son existence. */
export class NotFoundError extends DomainError {
  constructor(message = 'Ressource introuvable.') {
    super('NOT_FOUND', message);
  }
}

export class ConflictError extends DomainError {
  constructor(message: string) {
    super('CONFLICT', message);
  }
}
