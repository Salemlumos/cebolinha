import { readFileSync } from 'node:fs';

/**
 * Lê um WAV PCM16 mono (o formato que o recorder sempre grava) e devolve
 * as amostras como Float32 em [-1, 1], formato que o pipeline de Whisper
 * espera quando roda em Node (não aceita path/URL direto, só array de
 * amostras — ver https://huggingface.co/docs/transformers.js/guides/node-audio-processing).
 * @param {string} filePath
 * @returns {Float32Array}
 */
function readWavAsFloat32(filePath) {
  const buffer = readFileSync(filePath);
  const dataStart = 44;
  const sampleCount = Math.floor((buffer.length - dataStart) / 2);
  const floats = new Float32Array(sampleCount);
  for (let i = 0; i < sampleCount; i += 1) {
    floats[i] = buffer.readInt16LE(dataStart + i * 2) / 32768;
  }
  return floats;
}

let pipelinePromise;

function getPipeline(model) {
  if (!pipelinePromise) {
    pipelinePromise = import('@huggingface/transformers').then(({ pipeline }) =>
      pipeline('automatic-speech-recognition', model),
    );
  }
  return pipelinePromise;
}

/**
 * Adaptador local/gratuito de transcrição: roda Whisper via ONNX Runtime
 * na própria máquina (CPU), sem chave de API e sem custo por uso. O modelo
 * é baixado uma vez (cache do Hugging Face) e reaproveitado entre chamadas.
 * @param {import('../../config/env.js').Env} env
 * @returns {import('./index.js').Transcriber}
 */
export function createLocalTranscriber(env) {
  return {
    async transcribe(filePath, { language = env.TRANSCRIBE_LANGUAGE } = {}) {
      const transcriber = await getPipeline(env.TRANSCRIBE_MODEL);
      const audio = readWavAsFloat32(filePath);
      const result = await transcriber(audio, { language });
      return { text: (result.text ?? '').trim() };
    },
  };
}
