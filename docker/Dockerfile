# ---------------------------------------------------------
# 1) BUILD IMAGE — Node 22 für Nuxt 4
# ---------------------------------------------------------
FROM node:22-alpine AS build

WORKDIR /app

# Paketdateien kopieren (Cache-Hit für npm ci)
COPY package*.json ./

# Dependencies installieren – auch devDependencies sind für Nuxt-Build nötig
RUN npm ci --no-audit --prefer-offline

# Projekt kopieren
COPY . .

# Nuxt 4 Produktions-Build erstellen
RUN npm run build

# ---------------------------------------------------------
# 2) RUNTIME IMAGE — extra schlank
# ---------------------------------------------------------
FROM node:22-alpine AS runner

RUN apk add --no-cache openssh-client sshpass util-linux tzdata
ENV TZ=Europe/Vienna

WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/.output ./.output

EXPOSE 3000

CMD ["sh", "-c", "script -q -a -c \"node ./.output/server/index.mjs\" /app/logs/app.log"]
