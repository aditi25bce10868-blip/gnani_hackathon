// BharatConnect Worker — keeps the API keys off the phone.
//
//   GET  /health      → { ok: true }
//   POST /translate   → { text } | { texts: [...] }  (+ source, target, context?)
//   POST /stt         → { audio_base64 (WAV), language } → { text }
//   POST /tts         → { text, language } → { audio_base64 (WAV) }
//
// Every call except /health needs the header  X-App-Token: <APP_TOKEN>.
// `handle` takes the upstream fetch as a parameter so tests never touch Groq.

import { buildMessages, cleanOutput, parseBatch } from './prompt';
import { stt, tts } from './voice';

export interface Env {
  readonly GROQ_API_KEY: string;
  readonly APP_TOKEN: string;
  /** Optional override, default qwen/qwen3.8-27b. */
  readonly GROQ_MODEL?: string;
  /** Gnani key — speech in Indian languages. Without it, Whisper/device voice are used. */
  readonly GNANI_API_KEY?: string;
  /** 'groq' forces free Whisper for listening (saves Gnani credits). Default: gnani. */
  readonly STT_ENGINE?: string;
  readonly GNANI_STT_MODEL?: string;
  readonly GROQ_STT_MODEL?: string;
  readonly GNANI_TTS_SAMPLE_RATE?: string;
}

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'qwen/qwen3.8-27b';
const UPSTREAM_TIMEOUT_MS = 20_000;

const MAX_TEXT_CHARS = 2000;
const MAX_BATCH = 40;
const MAX_BATCH_CHARS = 4000;
const MAX_CONTEXT = 6;
const MAX_CONTEXT_CHARS = 300;

type UpstreamFetch = (url: string, init: RequestInit) => Promise<Response>;

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

const bad = (message: string): Response => json({ error: 'bad_request', message }, 400);

interface Parsed {
  readonly texts: string[];
  readonly batch: boolean;
  readonly source: string;
  readonly target: string;
  readonly context: string[];
  readonly sourceMix: string[];
}

function parseBody(raw: unknown): Parsed | Response {
  if (typeof raw !== 'object' || raw === null) return bad('Body must be a JSON object.');
  const b = raw as Record<string, unknown>;
  const source = typeof b.source === 'string' && b.source !== '' ? b.source : 'auto';
  const target = b.target;
  if (typeof target !== 'string' || target === '') return bad('"target" is required.');
  if (target === 'auto') return bad('"target" cannot be auto.');

  let texts: string[];
  let batch = false;
  if (typeof b.text === 'string') {
    texts = [b.text];
  } else if (Array.isArray(b.texts) && b.texts.every(t => typeof t === 'string')) {
    texts = b.texts as string[];
    batch = true;
    if (texts.length === 0 || texts.length > MAX_BATCH) return bad(`"texts" needs 1–${MAX_BATCH} items.`);
  } else {
    return bad('Send "text" (string) or "texts" (array of strings).');
  }
  if (texts.some(t => t.trim() === '')) return bad('Empty text.');
  if (!batch && texts[0].length > MAX_TEXT_CHARS) return bad(`Text longer than ${MAX_TEXT_CHARS} characters.`);
  if (batch && texts.join('').length > MAX_BATCH_CHARS) return bad(`Batch longer than ${MAX_BATCH_CHARS} characters.`);

  const context = Array.isArray(b.context)
    ? (b.context as unknown[])
        .filter((c): c is string => typeof c === 'string' && c.trim() !== '')
        .slice(-MAX_CONTEXT)
        .map(c => c.slice(0, MAX_CONTEXT_CHARS))
    : [];

  // Languages mixed into the source speech (code-mixed), e.g. ["en"] for Hindi + English.
  const sourceMix = Array.isArray(b.mix)
    ? (b.mix as unknown[]).filter((m): m is string => typeof m === 'string' && m !== '').slice(0, 3)
    : [];

  return { texts, batch, source, target, context, sourceMix };
}

async function translate(req: Request, env: Env, upstream: UpstreamFetch): Promise<Response> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return bad('Body is not valid JSON.');
  }
  const parsed = parseBody(raw);
  if (parsed instanceof Response) return parsed;

  const messages = buildMessages(parsed);  // `parsed.batch` rides along: a one-item `texts` array still gets the JSON prompt
  const payload: Record<string, unknown> = {
    model: env.GROQ_MODEL ?? DEFAULT_MODEL,
    messages,
    temperature: 0.2,
    // Thinking adds seconds of delay and burns the daily token allowance.
    reasoning_effort: 'none',
    reasoning_format: 'hidden',
  };
  if (parsed.batch) payload.response_format = { type: 'json_object' };

  let res: Response;
  try {
    res = await upstream(GROQ_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${env.GROQ_API_KEY}` },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch {
    return json({ error: 'upstream_unreachable' }, 502);
  }

  if (res.status === 429) {
    const retry = res.headers.get('retry-after') ?? '';
    return json({ error: 'rate_limited', retryAfter: retry }, 429, retry ? { 'retry-after': retry } : {});
  }
  if (!res.ok) return json({ error: 'upstream_error', status: res.status }, 502);

  let content = '';
  try {
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    content = data.choices?.[0]?.message?.content ?? '';
  } catch {
    return json({ error: 'upstream_bad_json' }, 502);
  }

  if (parsed.batch) {
    const list = parseBatch(content, parsed.texts.length);
    if (!list) return json({ error: 'bad_model_output' }, 502);
    return json({ texts: list.map(cleanOutput) });
  }
  const text = cleanOutput(content);
  if (text === '') return json({ error: 'empty_output' }, 502);
  return json({ text });
}

export async function handle(req: Request, env: Env, upstream: UpstreamFetch): Promise<Response> {
  const url = new URL(req.url);
  if (req.method === 'GET' && url.pathname === '/health') return json({ ok: true });

  if (req.headers.get('x-app-token') !== env.APP_TOKEN || env.APP_TOKEN === '') {
    return json({ error: 'unauthorized' }, 401);
  }
  if (req.method === 'POST' && url.pathname === '/translate') return translate(req, env, upstream);
  if (req.method === 'POST' && url.pathname === '/stt') return stt(req, env, upstream);
  if (req.method === 'POST' && url.pathname === '/tts') return tts(req, env, upstream);
  return json({ error: 'not_found' }, 404);
}