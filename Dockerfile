# Фронтенд Chaos Organizer: сборка webpack → статика под nginx.
FROM node:20-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# --- рантайм: только готовая статика, без node и исходников ---
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
