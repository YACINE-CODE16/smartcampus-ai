import { bi } from '@smartcampus/shared';

/**
 * Erreurs métier, indépendantes du transport. La couche HTTP les traduit en codes.
 * Les messages peuvent être bilingues (`bi(fr, en)`) : la langue est choisie à la réponse.
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
  constructor(message: string = bi('Certains champs sont invalides.', 'Some fields are invalid.'), fields?: Record<string, string>) {
    super('VALIDATION', message, fields);
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message: string = bi('Authentification requise.', 'Authentication required.')) {
    super('UNAUTHORIZED', message);
  }
}

export class ForbiddenError extends DomainError {
  constructor(message: string = bi('Accès refusé.', 'Access denied.')) {
    super('FORBIDDEN', message);
  }
}

/** Utilisé aussi pour un ticket existant mais non autorisé : on ne révèle pas son existence. */
export class NotFoundError extends DomainError {
  constructor(message: string = bi('Ressource introuvable.', 'Not found.')) {
    super('NOT_FOUND', message);
  }
}

export class ConflictError extends DomainError {
  constructor(message: string) {
    super('CONFLICT', message);
  }
}
