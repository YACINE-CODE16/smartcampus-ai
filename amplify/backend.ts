import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';

/**
 * Backend SmartCampus AI.
 * Phase 0 : authentification seule. Les ressources Data, Storage et Functions
 * sont ajoutées phase par phase (voir .kiro/specs/smartcampus-ai/tasks.md).
 */
defineBackend({
  auth,
});
