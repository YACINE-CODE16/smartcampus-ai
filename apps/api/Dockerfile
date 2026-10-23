# API SmartCampus — image de production (contexte de build : racine du dépôt).
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

# Dépendances des seuls workspaces api + shared ; le schéma Prisma est requis par `postinstall` (prisma generate).
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/api/prisma apps/api/prisma
COPY apps/api/prisma.config.ts apps/api/
RUN npm ci -w @smartcampus/api -w @smartcampus/shared --include=dev && npm cache clean --force

COPY packages/shared packages/shared
COPY apps/api apps/api

WORKDIR /app/apps/api
# Dossier inscriptible par l'utilisateur non-root : photos (STORAGE_DRIVER=local) et emails (MAIL_DRIVER=console).
RUN mkdir -p storage/uploads storage/outbox && chown -R node:node storage
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --start-interval=3s CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1
# Migrations appliquées à chaque démarrage (idempotent), puis lancement de l'API.
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx src/server.ts"]
