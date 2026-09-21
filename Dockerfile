# Usa "slim" (Debian/glibc), não "alpine": onnxruntime-node e ffmpeg-static
# só têm binários pré-compilados para glibc — em Alpine (musl) o
# node-gyp tentaria compilar do zero e falharia sem toolchain nativo.
# Node 22+ porque @discordjs/voice/openai/vitest exigem >=22.
FROM node:22-slim

WORKDIR /app

# Por padrão o provider é "groq" (transcrição roda no serviço da Groq, não
# nesta imagem) — não há nada pra baixar/bakear no build. Só se você for
# usar TRANSCRIBER_PROVIDER=local é que faz sentido bakear um modelo Whisper
# aqui: `docker build --build-arg TRANSCRIBER_PROVIDER=local --build-arg TRANSCRIBE_MODEL=Xenova/whisper-base .`
ARG TRANSCRIBER_PROVIDER=groq
ARG TRANSCRIBE_MODEL=Xenova/whisper-base

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY scripts ./scripts

# Se TRANSCRIBER_PROVIDER=local, baixa e cacheia o modelo Whisper durante o
# build, para o container não precisar de rede no primeiro /finish. Com
# groq/openai isso não se aplica (a transcrição roda num serviço externo).
RUN if [ "$TRANSCRIBER_PROVIDER" = "local" ]; then \
      TRANSCRIBE_MODEL=$TRANSCRIBE_MODEL node -e "import('@huggingface/transformers').then(({ pipeline }) => pipeline('automatic-speech-recognition', process.env.TRANSCRIBE_MODEL))"; \
    else \
      echo "TRANSCRIBER_PROVIDER=$TRANSCRIBER_PROVIDER: nada para bakear (transcrição roda fora desta imagem)"; \
    fi

ENV NODE_ENV=production
VOLUME ["/app/data"]

CMD ["node", "src/index.js"]
