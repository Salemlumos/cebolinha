# Usa "slim" (Debian/glibc), não "alpine": ffmpeg-static só tem binário
# pré-compilado para glibc.
# Node 22+ porque @discordjs/voice/vitest exigem >=22.
FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY scripts ./scripts

ENV NODE_ENV=production
VOLUME ["/app/data"]

CMD ["node", "src/index.js"]
