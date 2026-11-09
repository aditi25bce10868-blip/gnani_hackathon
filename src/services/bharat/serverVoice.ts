// Listening and speaking through the BharatConnect server (Gnani / Whisper).

import { postJson, ServerError, type ServerConfig } from './serverApi';

/** Languages Gnani can speak. Everything else uses the phone's own voice. */
export const SERVER_TTS_LANGS: ReadonlySet<string> = new Set([
  'en', 'hi', 'ta', 'te', 'kn', 'ml', 'mr', 'pa', 'bn', 'gu', 'hi-hinglish',
]);

const CACHE_MAX = 20;
// Spoken replies repeat (greetings, "thank you"); replaying costs no credits.
const audioCache = new Map<string, string>();

/** Base64 WAV of `text` spoken in `lang`. */
export async function synthesize(
  cfg: ServerConfig,
  text: string,
  lang: string,
  fetchImpl?: typeof fetch,
): Promise<string> {
  const key = `${lang}|${text}`;
  const hit = audioCache.get(key);
  if (hit) return hit;
  const body = await postJson(cfg, '/tts', { text, language: lang }, fetchImpl);
  const audio = body.audio_base64;
  if (typeof audio !== 'string' || audio === '') throw new ServerError('The server sent back no audio.');
  if (audioCache.size >= CACHE_MAX) {
    const oldest = audioCache.keys().next().value;
    if (oldest !== undefined) audioCache.delete(oldest);
  }
  audioCache.set(key, audio);
  return audio;
}

export interface TranscribeOptions {
  /** Languages the speaker mixes in with `lang` (code-mixed speech), e.g. ['en']. */
  readonly mix?: readonly string[];
}

/** What was said, and the language Gnani says it heard (hands-free routes on it). */
export async function transcribeDetailed(
  cfg: ServerConfig,
  wavBase64: string,
  lang: string,
  fetchImpl?: typeof fetch,
  opts: TranscribeOptions = {},
): Promise<{ readonly text: string; readonly detected?: string }> {
  const payload: Record<string, unknown> = { audio_base64: wavBase64, language: lang };
  if (opts.mix && opts.mix.length > 0) payload.mix = opts.mix;
  const body = await postJson(cfg, '/stt', payload, fetchImpl);
  return {
    text: typeof body.text === 'string' ? body.text : '',
    detected: typeof body.detected === 'string' && body.detected !== '' ? body.detected : undefined,
  };
}

/** What was said in a base64 WAV recording, in `lang` (plus any `mix` languages). */
export async function transcribe(
  cfg: ServerConfig,
  wavBase64: string,
  lang: string,
  fetchImpl?: typeof fetch,
  opts: TranscribeOptions = {},
): Promise<string> {
  const payload: Record<string, unknown> = { audio_base64: wavBase64, language: lang };
  if (opts.mix && opts.mix.length > 0) payload.mix = opts.mix;
  const body = await postJson(cfg, '/stt', payload, fetchImpl);
  return typeof body.text === 'string' ? body.text : '';
}

export function clearAudioCache(): void {
  audioCache.clear();
}
