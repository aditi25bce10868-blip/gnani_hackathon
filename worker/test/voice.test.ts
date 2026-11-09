/** @jest-environment node */
import { handle, type Env } from '../src/handler';

const env: Env = { GROQ_API_KEY: 'gk', GNANI_API_KEY: 'nk', APP_TOKEN: 'tok' };
const WAV_B64 = Buffer.alloc(2000, 1).toString('base64');

function req(path: string, body: unknown): Request {
  return new Request(`https://w.test${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-app-token': 'tok' },
    body: JSON.stringify(body),
  });
}

function upstream(status: number, body: unknown | Uint8Array) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fn = async (url: string, init: RequestInit): Promise<Response> => {
    calls.push({ url, init });
    const payload = body instanceof Uint8Array ? body : JSON.stringify(body);
    return new Response(payload as BodyInit, { status });
  };
  return { fn, calls };
}

const header = (c: { init: RequestInit }, k: string) => (c.init.headers as Record<string, string>)[k];

describe('/stt', () => {
  test('Gnani: sends the WAV with key, model and language code; returns the transcript', async () => {
    const u = upstream(200, { success: true, transcript: ' नमस्ते ' });
    const r = await handle(req('/stt', { audio_base64: WAV_B64, language: 'hi' }), env, u.fn);
    expect(await r.json()).toEqual({ text: 'नमस्ते', language: 'hi', engine: 'gnani' });
    expect(u.calls[0].url).toBe('https://api.vachana.ai/stt/v3');
    expect(header(u.calls[0], 'x-api-key-id')).toBe('nk');
    const form = u.calls[0].init.body as FormData;
    expect(form.get('language_code')).toBe('hi-IN');
    expect(form.get('model')).toBe('prisma-v3.0');
    expect((form.get('audio_file') as Blob).size).toBe(2000);
  });

  test('mixed speech: language + hints go to Gnani as a list, written so English stays Latin', async () => {
    const u = upstream(200, { success: true, transcript: 'मैं tomorrow office जा रहा हूँ', detected_language_code: 'hi-IN' });
    const r = await handle(req('/stt', { audio_base64: WAV_B64, language: 'hi', mix: ['en'] }), env, u.fn);
    expect(await r.json()).toEqual({
      text: 'मैं tomorrow office जा रहा हूँ',
      language: 'hi',
      engine: 'gnani',
      detected: 'hi-IN',
    });
    const form = u.calls[0].init.body as FormData;
    expect(form.get('language_code')).toBe('hi-IN,en-IN');
    expect(form.get('format')).toBe('transcribe');
    expect(form.get('model')).toBe('prisma-v3.0');
  });

  test('mixed speech: duplicates, unknown codes and Hinglish hints are dropped; max four languages', async () => {
    const u = upstream(200, { success: true, transcript: 'x' });
    await handle(
      req('/stt', { audio_base64: WAV_B64, language: 'ta', mix: ['ta', 'en', 'xx', 'hi-hinglish', 'te', 'kn', 'ml'] }),
      env,
      u.fn,
    );
    const form = u.calls[0].init.body as FormData;
    expect(form.get('language_code')).toBe('ta-IN,en-IN,te-IN,kn-IN');
  });

  test('no mix → exactly the old single-language request (no format field)', async () => {
    const u = upstream(200, { success: true, transcript: 'x' });
    await handle(req('/stt', { audio_base64: WAV_B64, language: 'hi' }), env, u.fn);
    const form = u.calls[0].init.body as FormData;
    expect(form.get('language_code')).toBe('hi-IN');
    expect(form.get('format')).toBeNull();
  });

  test('Hinglish is heard as Romanised text', async () => {
    const u = upstream(200, { success: true, transcript: 'kal office jaana hai' });
    const r = await handle(req('/stt', { audio_base64: WAV_B64, language: 'hi-hinglish', mix: ['en'] }), env, u.fn);
    expect(((await r.json()) as { text: string }).text).toBe('kal office jaana hai');
    const form = u.calls[0].init.body as FormData;
    expect(form.get('language_code')).toBe('hi-IN');
    expect(form.get('format')).toBe('transliterate');
  });

  test('an older Gnani model (GNANI_STT_MODEL) never gets lists or styles', async () => {
    const u = upstream(200, { success: true, transcript: 'x' });
    await handle(
      req('/stt', { audio_base64: WAV_B64, language: 'hi', mix: ['en'] }),
      { ...env, GNANI_STT_MODEL: 'prisma-v2.5' },
      u.fn,
    );
    const form = u.calls[0].init.body as FormData;
    expect(form.get('language_code')).toBe('hi-IN');
    expect(form.get('format')).toBeNull();
  });

  test('mixed speech on the free Whisper path just uses the main language', async () => {
    const u = upstream(200, { text: 'x' });
    await handle(req('/stt', { audio_base64: WAV_B64, language: 'hi', mix: ['en'] }), { ...env, STT_ENGINE: 'groq' }, u.fn);
    const form = u.calls[0].init.body as FormData;
    expect(form.get('language')).toBe('hi');
  });

  test('a language Gnani lacks (Assamese) falls back to free Whisper', async () => {
    const u = upstream(200, { text: 'নমস্কাৰ' });
    const r = await handle(req('/stt', { audio_base64: WAV_B64, language: 'as' }), env, u.fn);
    expect(((await r.json()) as { engine: string }).engine).toBe('whisper');
    expect(u.calls[0].url).toContain('api.groq.com');
    expect(header(u.calls[0], 'authorization')).toBe('Bearer gk');
    const form = u.calls[0].init.body as FormData;
    expect(form.get('language')).toBe('as');
    expect(form.get('model')).toBe('whisper-large-v3');
  });

  test('STT_ENGINE=groq forces Whisper even for Hindi', async () => {
    const u = upstream(200, { text: 'x' });
    await handle(req('/stt', { audio_base64: WAV_B64, language: 'hi' }), { ...env, STT_ENGINE: 'groq' }, u.fn);
    expect(u.calls[0].url).toContain('api.groq.com');
  });

  test('no Gnani key → Whisper', async () => {
    const u = upstream(200, { text: 'x' });
    await handle(req('/stt', { audio_base64: WAV_B64, language: 'ta' }), { ...env, GNANI_API_KEY: undefined }, u.fn);
    expect(u.calls[0].url).toContain('api.groq.com');
  });

  test('Odia has no engine → clear error, nothing sent upstream', async () => {
    const u = upstream(200, {});
    const r = await handle(req('/stt', { audio_base64: WAV_B64, language: 'or' }), env, u.fn);
    expect(r.status).toBe(400);
    expect(((await r.json()) as { error: string }).error).toBe('unsupported_language');
    expect(u.calls).toHaveLength(0);
  });

  test.each([
    [{ language: 'hi' }],
    [{ audio_base64: WAV_B64 }],
    [{ audio_base64: '***', language: 'hi' }],
    [{ audio_base64: Buffer.alloc(1_400_000).toString('base64'), language: 'hi' }],
  ])('rejects bad input #%#', async body => {
    expect((await handle(req('/stt', body), env, upstream(200, {}).fn)).status).toBe(400);
  });

  test.each([
    [402, 402, 'no_credits'],
    [429, 429, 'rate_limited'],
    [401, 502, 'upstream_auth'],
    [500, 502, 'upstream_error'],
  ])('upstream %i → %i %s', async (up, status, code) => {
    const r = await handle(req('/stt', { audio_base64: WAV_B64, language: 'hi' }), env, upstream(up, {}).fn);
    expect(r.status).toBe(status);
    expect(((await r.json()) as { error: string }).error).toBe(code);
  });
});

describe('/tts', () => {
  test('sends the right voice for the language and returns base64 WAV', async () => {
    const wav = new Uint8Array(500).fill(7);
    const u = upstream(200, wav);
    const r = await handle(req('/tts', { text: 'नमस्ते', language: 'hi' }), env, u.fn);
    const out = (await r.json()) as { audio_base64: string; format: string };
    expect(out.format).toBe('wav');
    expect(Buffer.from(out.audio_base64, 'base64')).toHaveLength(500);
    expect(u.calls[0].url).toBe('https://api.vachana.ai/api/v1/tts/inference');
    expect(header(u.calls[0], 'x-api-key-id')).toBe('nk');
    const sent = JSON.parse(String(u.calls[0].init.body));
    expect(sent).toMatchObject({ voice: 'Nalini', model: 'timbre-v2.5', language: 'hi-IN', text: 'नमस्ते' });
    expect(sent.audio_config.container).toBe('wav');
  });

  test('Tamil gets a Tamil voice, Hinglish gets hi-en', async () => {
    const u = upstream(200, new Uint8Array(200));
    await handle(req('/tts', { text: 'a', language: 'ta' }), env, u.fn);
    await handle(req('/tts', { text: 'a', language: 'hi-hinglish' }), env, u.fn);
    expect(JSON.parse(String(u.calls[0].init.body))).toMatchObject({ voice: 'Asmita', language: 'ta-IN' });
    expect(JSON.parse(String(u.calls[1].init.body))).toMatchObject({ voice: 'Poorvi', language: 'hi-en' });
  });

  test('Odia / Urdu → unsupported_language so the app uses the phone voice', async () => {
    const u = upstream(200, new Uint8Array(200));
    const r = await handle(req('/tts', { text: 'a', language: 'or' }), env, u.fn);
    expect(r.status).toBe(400);
    expect(((await r.json()) as { error: string }).error).toBe('unsupported_language');
    expect(u.calls).toHaveLength(0);
  });

  test('long text and empty text are rejected before spending credits', async () => {
    const u = upstream(200, new Uint8Array(200));
    expect((await handle(req('/tts', { text: 'x'.repeat(601), language: 'hi' }), env, u.fn)).status).toBe(400);
    expect((await handle(req('/tts', { text: '  ', language: 'hi' }), env, u.fn)).status).toBe(400);
    expect(u.calls).toHaveLength(0);
  });

  test('402 → no_credits', async () => {
    const r = await handle(req('/tts', { text: 'a', language: 'hi' }), env, upstream(402, {}).fn);
    expect(r.status).toBe(402);
  });
});
