import serverless from 'serverless-http';
import { env } from '../config/env';
import { createContainer } from '../container';
import { createApp } from '../http/app';

/**
 * Lambdas Incidents, Dashboard, Assistant et Fichiers : le même bundle Express, derrière API Gateway (HTTP API).
 * API Gateway choisit la Lambda selon le préfixe du chemin ; Express route ensuite comme en local.
 * Le conteneur (client Prisma, adapters) est créé une fois par environnement d'exécution et réutilisé.
 */
const container = createContainer(env);
export const handler = serverless(createApp(container));
