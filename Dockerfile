# Usa "slim" (Debian/glibc), não "alpine": onnxruntime-node e ffmpeg-static
# só têm binários pré-compilados para glibc — em Alpine (musl) o
# node-gyp tentaria compilar do zero e falharia sem toolchain nativo.
# Node 22+ porque @discordjs/voice/openai/vitest exigem >=22.
FROM node:22-slim

WORKDIR /app

# Argumento de build para bakear o modelo Whisper na imagem. Se você mudar
# TRANSCRIBE_MODEL no .env em runtime, o modelo será baixado sob demanda no
# primeiro /finish (precisa de rede nesse momento).
ARG TRANSCRIBE_MODEL=Xenova/whisper-base

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY scripts ./scripts

# Baixa e cacheia o modelo Whisper durante o build, para o container não
# precisar de rede no primeiro /finish em produção.
RUN TRANSCRIBE_MODEL=$TRANSCRIBE_MODEL node -e "import('@huggingface/transformers').then(({ pipeline }) => pipeline('automatic-speech-recognition', process.env.TRANSCRIBE_MODEL))"

ENV NODE_ENV=production
VOLUME ["/app/data"]

CMD ["node", "src/index.js"]
