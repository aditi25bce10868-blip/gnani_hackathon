// Speech routes: /stt (listen) and /tts (speak).
//
// Credits are the scarce resource (Gnani: 5k free), so:
//   • listening uses Gnani, but languages Gnani lacks fall back to Groq
//     Whisper (free), and STT_ENGINE=groq forces Whisper for everyday dev;
//   • speaking uses Gnani only for the languages it has; the app falls back to
//     the phone's own voice for the rest (we answer 400 unsupported_language).

import type { Env } from './handler';

type UpstreamFetch = (url: string, init: RequestInit) => Promise<Response>;

const GNANI_STT_URL = 'https://api.vachana.ai/stt/v3';
const GNANI_TTS_URL = 'https://api.vachana.ai/api/v1/tts/inference';
const GROQ_STT_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const UPSTREAM_TIMEOUT_MS = 30_000;

/** Gnani covers exactly these 10 (STT and TTS alike). */
const GNANI_CODE: Record<string, string> = {
  en: 'en-IN', hi: 'hi-IN', ta: 'ta-IN', te: 'te-IN', kn: 'kn-IN',
  ml: 'ml-IN', mr: 'mr-IN', pa: 'pa-IN', bn: 'bn-IN', gu: 'gu-IN',
  'hi-hinglish': 'hi-IN',
};

/** One default voice per language (Gnani "Timbre v2.5" voices have one language each). */
const GNANI_VOICE: Record<string, { voice: string; language: string }> = {
  en: { voice: 'Devika', language: 'en-IN' },
  hi: { voice: 'Nalini', language: 'hi-IN' },
  ta: { voice: 'Asmita', language: 'ta-IN' },
  te: { voice: 'Lavanya', language: 'te-IN' },
  kn: { voice: 'Saanvi', language: 'kn-IN' },
  ml: { voice: 'Reshma', language: 'ml-IN' },
  mr: { voice: 'Zahira', language: 'mr-IN' },
  pa: { voice: 'Mehuli', language: 'pa-IN' },
  bn: { voice: 'Kirra', language: 'bn-IN' },
  gu: { voice: 'Falak', language: 'gu-IN' },
  'hi-hinglish': { voice: 'Poorvi', language: 'hi-en' },
};

/** Whisper's codes for the Indian languages it knows (Odia it does not). */
const WHISPER_CODE: Record<string, string> = {
  en: 'en', hi: 'hi', ta: 'ta', te: 'te', kn: 'kn', ml: 'ml', mr: 'mr',
  pa: 'pa', bn: 'bn', gu: 'gu', as: 'as', ur: 'ur', 'hi-hinglish': 'hi',
};

const MAX_AUDIO_BYTES = 1_300_000; // ≈ 40 s of 16 kHz 16-bit mono; Gnani allows 30 s
const MAX_TTS_CHARS = 600;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}
const bad = (message: string, error = 'bad_request'): Response => json({ error, message }, 400);

function fromBase64(b64: string): Uint8Array<ArrayBuffer> | null {
  try {
    const bin = atob(b64);
    const out = new Uint8Array(new ArrayBuffer(bin.length));
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

/** Maps a failed Gnani / Groq answer to what the app should see. */
function upstreamFailure(res: Response): Response {
  if (res.status === 402) return json({ error: 'no_credits' }, 402);
  if (res.status === 429) return json({ error: 'rate_limited' }, 429);
  if (res.status === 401 || res.status === 403) return json({ error: 'upstream_auth' }, 502);
  if (res.status === 400) return json({ error: 'bad_audio' }, 400);
  return json({ error: 'upstream_error', status: res.status }, 502);
}

async function call(upstream: UpstreamFetch, url: string, init: RequestInit): Promise<Response | null> {
  try {
    return await upstream(url, { ...init, signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
  } catch {
    return null;
  }
}


const GNANI_V3 = 'prisma-v3.0';
/** Gnani's Prisma v3.0 takes up to four language hints in one request. */
const MAX_GNANI_LANGS = 4;
/** How a mixed (e.g. Hindi + English) transcript is written: English words stay
 *  in Latin letters, numbers become digits. Best input for the translator. */
const MIXED_FORMAT = 'transcribe';

export interface GnaniLanguageSpec {
  /** Value for the `language_code` field — one code, or a comma-separated list. */
  readonly languageCode: string;
  /** Value for `format`, or undefined to keep Gnani's own default. */
  readonly format: string | undefined;
}

/**
 * What to ask Gnani for.
 *  • plain          → one language, Gnani's default style (unchanged behaviour);
 *  • mixed          → the language plus the `mix` hints (Prisma v3.0 only), as a
 *                     list, written so English words stay Latin;
 *  • Hinglish       → Romanised output (`transliterate`), Prisma v3.0 only.
 * Older models (set through GNANI_STT_MODEL) accept one language and no style
 * options, so they always get the plain request.
 */
export function gnaniLanguageSpec(language: string, mix: readonly string[], model: string): GnaniLanguageSpec {
  const primary = GNANI_CODE[language];
  if (primary === undefined) return { languageCode: '', format: undefined };
  if (model !== GNANI_V3) return { languageCode: primary, format: undefined };
  if (language === 'hi-hinglish') return { languageCode: primary, format: 'transliterate' };

  const codes = [primary];
  for (const m of mix) {
    const c = GNANI_CODE[m];
    if (c !== undefined && !codes.includes(c) && m !== 'hi-hinglish') codes.push(c);
  }
  if (codes.length === 1) return { languageCode: primary, format: undefined };
  return { languageCode: codes.slice(0, MAX_GNANI_LANGS).join(','), format: MIXED_FORMAT };
}

function stringList(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x !== '') : [];
}

export async function stt(req: Request, env: Env, upstream: UpstreamFetch): Promise<Response> {
  let b: Record<string, unknown>;
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return bad('Body is not valid JSON.');
  }
  const language = typeof b.language === 'string' ? b.language : '';
  if (typeof b.audio_base64 !== 'string' || b.audio_base64 === '' || language === '') {
    return bad('Send "audio_base64" (WAV) and "language".');
  }
  const bytes = fromBase64(b.audio_base64);
  if (!bytes || bytes.length < 100) return bad('Audio is empty or not valid base64.', 'bad_audio');
  if (bytes.length > MAX_AUDIO_BYTES) return bad('Audio is too long (30 seconds maximum).', 'too_long');

  const useGnani =
    env.STT_ENGINE !== 'groq' && GNANI_CODE[language] !== undefined && (env.GNANI_API_KEY ?? '') !== '';
  const whisper = WHISPER_CODE[language];
  if (!useGnani && whisper === undefined) {
    return bad(`No speech engine for "${language}" yet.`, 'unsupported_language');
  }

  const form = new FormData();
  form.append(useGnani ? 'audio_file' : 'file', new Blob([bytes], { type: 'audio/wav' }), 'audio.wav');
  let res: Response | null;
  if (useGnani) {
    const model = env.GNANI_STT_MODEL ?? GNANI_V3;
    const spec = gnaniLanguageSpec(language, stringList(b.mix), model);
    form.append('model', model);
    form.append('language_code', spec.languageCode);
    if (spec.format !== undefined) form.append('format', spec.format);
    res = await call(upstream, GNANI_STT_URL, { method: 'POST', headers: { 'x-api-key-id': env.GNANI_API_KEY as string }, body: form });
  } else {
    form.append('model', env.GROQ_STT_MODEL ?? 'whisper-large-v3');
    form.append('language', whisper);
    form.append('response_format', 'json');
    form.append('temperature', '0');
    res = await call(upstream, GROQ_STT_URL, { method: 'POST', headers: { authorization: `Bearer ${env.GROQ_API_KEY}` }, body: form });
  }
  if (!res) return json({ error: 'upstream_unreachable' }, 502);
  if (!res.ok) return upstreamFailure(res);

  let data: { transcript?: string; text?: string; detected_language_code?: string };
  try {
    data = (await res.json()) as { transcript?: string; text?: string; detected_language_code?: string };
  } catch {
    return json({ error: 'upstream_bad_json' }, 502);
  }
  const text = (useGnani ? data.transcript : data.text) ?? '';
  // `detected` = the language the transcript turned out to be written in (Gnani
  // reports it; useful for mixed speech). Absent for Whisper and for Romanised output.
  return json({
    text: text.trim(),
    language,
    engine: useGnani ? 'gnani' : 'whisper',
    detected: useGnani ? data.detected_language_code : undefined,
  });
}

export async function tts(req: Request, env: Env, upstream: UpstreamFetch): Promise<Response> {
  let b: Record<string, unknown>;
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return bad('Body is not valid JSON.');
  }
  const text = typeof b.text === 'string' ? b.text.trim() : '';
  const language = typeof b.language === 'string' ? b.language : '';
  if (text === '' || language === '') return bad('Send "text" and "language".');
  if (text.length > MAX_TTS_CHARS) return bad(`Text longer than ${MAX_TTS_CHARS} characters.`);
  const v = GNANI_VOICE[language];
  if (!v || (env.GNANI_API_KEY ?? '') === '') {
    return bad(`No server voice for "${language}".`, 'unsupported_language');
  }

  // 24 kHz: speech is clear and the clip is half the size of 48 kHz, which is
  // most of the wait on a phone connection. GNANI_TTS_SAMPLE_RATE overrides it.
  const configured = Number(env.GNANI_TTS_SAMPLE_RATE);
  const sampleRate = Number.isFinite(configured) && configured > 0 ? configured : 24000;
  const res = await call(upstream, GNANI_TTS_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key-id': env.GNANI_API_KEY as string },
    body: JSON.stringify({
      text,
      voice: v.voice,
      model: 'timbre-v2.5',
      language: v.language,
      speed: typeof b.speed === 'number' ? b.speed : 1.0,
      audio_config: { sample_rate: sampleRate, num_channels: 1, sample_width: 2, encoding: 'linear_pcm', container: 'wav' },
    }),
  });
  if (!res) return json({ error: 'upstream_unreachable' }, 502);
  if (!res.ok) return upstreamFailure(res);
  const audio = new Uint8Array(await res.arrayBuffer());
  if (audio.length < 100) return json({ error: 'empty_audio' }, 502);
  return json({ audio_base64: toBase64(audio), format: 'wav' });
}
