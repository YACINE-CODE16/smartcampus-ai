# Front SmartCampus — build Vite puis service statique nginx (contexte de build : racine du dépôt).
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
RUN npm ci -w @smartcampus/web -w @smartcampus/shared --include-workspace-root --include=dev --ignore-scripts
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN npm run build -w @smartcampus/web

FROM nginx:1.27-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --start-interval=2s CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
