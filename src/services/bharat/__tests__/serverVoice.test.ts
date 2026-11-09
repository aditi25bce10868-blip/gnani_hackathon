import { postJson, ServerError, UnsupportedLanguageError } from '../serverApi';
import { clearAudioCache, synthesize, transcribe } from '../serverVoice';
import { ServerSttProvider, type SttDeps } from '../serverStt';

const cfg = { baseUrl: 'https://api.test', appToken: 'tok', timeoutMs: 50 };

function fake(status: number, body: unknown) {
  const fn = jest.fn(async (_u: string, _i: RequestInit) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }));
  return { fn, impl: fn as unknown as typeof fetch };
}

describe('postJson errors', () => {
  test.each([
    [402, { error: 'no_credits' }, /credits/i],
    [429, { error: 'rate_limited' }, /too many/i],
    [400, { error: 'bad_audio' }, /recording/i],
    [502, { error: 'upstream_error' }, /problem/i],
  ])('status %i', async (status, body, msg) => {
    await expect(postJson(cfg, '/x', {}, fake(status, body).impl)).rejects.toThrow(msg);
  });
  test('unsupported language is its own error type', async () => {
    await expect(postJson(cfg, '/tts', {}, fake(400, { error: 'unsupported_language' }).impl)).rejects.toBeInstanceOf(
      UnsupportedLanguageError,
    );
  });
});

describe('synthesize / transcribe', () => {
  beforeEach(clearAudioCache);

  test('synthesize posts text + language and caches the audio', async () => {
    const f = fake(200, { audio_base64: 'QUJD' });
    expect(await synthesize(cfg, 'नमस्ते', 'hi', f.impl)).toBe('QUJD');
    expect(await synthesize(cfg, 'नमस्ते', 'hi', f.impl)).toBe('QUJD');
    expect(f.fn).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(f.fn.mock.calls[0][1].body))).toEqual({ text: 'नमस्ते', language: 'hi' });
    expect(f.fn.mock.calls[0][0]).toBe('https://api.test/tts');
  });

  test('a different language is a different cache entry', async () => {
    const f = fake(200, { audio_base64: 'QUJD' });
    await synthesize(cfg, 'ok', 'hi', f.impl);
    await synthesize(cfg, 'ok', 'ta', f.impl);
    expect(f.fn).toHaveBeenCalledTimes(2);
  });

  test('empty audio is an error, not silence', async () => {
    await expect(synthesize(cfg, 'a', 'hi', fake(200, {}).impl)).rejects.toBeInstanceOf(ServerError);
  });

  test('transcribe sends the WAV and language, returns the text', async () => {
    const f = fake(200, { text: 'नमस्ते' });
    expect(await transcribe(cfg, 'WAVDATA', 'hi', f.impl)).toBe('नमस्ते');
    expect(JSON.parse(String(f.fn.mock.calls[0][1].body))).toEqual({ audio_base64: 'WAVDATA', language: 'hi' });
  });
});

describe('ServerSttProvider', () => {
  const b64 = (bytes: number) => Buffer.alloc(bytes, 1).toString('base64');

  function deps(over: Partial<{ perm: boolean; granted: boolean; wav: string; recording: boolean }> = {}) {
    const capture = {
      hasPermission: jest.fn(async () => over.perm ?? true),
      requestPermission: jest.fn(async () => over.granted ?? true),
      start: jest.fn(),
      stop: jest.fn(async () => '/rec.wav'),
      isRecording: over.recording ?? false,
    };
    const f = fake(200, { text: 'hello' });
    const d: SttDeps = { capture, readBase64: async () => over.wav ?? b64(64_000), fetchImpl: f.impl };
    return { d, capture, f };
  }

  test('start asks for the mic once, then records', async () => {
    const { d, capture } = deps({ perm: false, granted: true });
    await new ServerSttProvider(cfg, d).start('hi');
    expect(capture.requestPermission).toHaveBeenCalled();
    expect(capture.start).toHaveBeenCalled();
  });

  test('refused permission stops before recording', async () => {
    const { d, capture } = deps({ perm: false, granted: false });
    await expect(new ServerSttProvider(cfg, d).start('hi')).rejects.toThrow(/permission/i);
    expect(capture.start).not.toHaveBeenCalled();
  });

  test('stop uploads the recording in the chosen language', async () => {
    const { d, f } = deps();
    const p = new ServerSttProvider(cfg, d);
    await p.start('ta');
    expect(await p.stop()).toEqual({ text: 'hello', lang: 'ta' });
    expect(JSON.parse(String(f.fn.mock.calls[0][1].body)).language).toBe('ta');
  });

  test('a mis-tap (almost no audio) returns empty text without calling the server', async () => {
    const { d, f } = deps({ wav: b64(2_000) });
    const p = new ServerSttProvider(cfg, d);
    await p.start('hi');
    expect((await p.stop()).text).toBe('');
    expect(f.fn).not.toHaveBeenCalled();
  });

  test('over 30 seconds is refused with a clear message', async () => {
    const { d, f } = deps({ wav: b64(1_100_000) });
    const p = new ServerSttProvider(cfg, d);
    await p.start('hi');
    await expect(p.stop()).rejects.toThrow(/30 seconds/);
    expect(f.fn).not.toHaveBeenCalled();
  });

  test('cancel stops a live recording and ignores an idle one', () => {
    const live = deps({ recording: true });
    new ServerSttProvider(cfg, live.d).cancel();
    expect(live.capture.stop).toHaveBeenCalled();
    const idle = deps({ recording: false });
    new ServerSttProvider(cfg, idle.d).cancel();
    expect(idle.capture.stop).not.toHaveBeenCalled();
  });
});

describe('transcribe with mixed speech', () => {
  test('mix languages ride along; without them the request is exactly as before', async () => {
    const f = fake(200, { text: 'x' });
    await transcribe(cfg, 'W', 'hi', f.impl, { mix: ['en'] });
    expect(JSON.parse(String(f.fn.mock.calls[0][1].body))).toEqual({ audio_base64: 'W', language: 'hi', mix: ['en'] });
    await transcribe(cfg, 'W', 'hi', f.impl, { mix: [] });
    expect(JSON.parse(String(f.fn.mock.calls[1][1].body))).toEqual({ audio_base64: 'W', language: 'hi' });
  });
});

describe('error kinds', () => {
  test.each([
    [402, { error: 'no_credits' }, 'credits'],
    [429, { error: 'rate_limited' }, 'rate_limited'],
    [401, {}, 'auth'],
    [400, { error: 'bad_audio' }, 'audio'],
    [502, { error: 'upstream_error' }, 'other'],
  ])('status %i → %s', async (status, body, kind) => {
    await expect(postJson(cfg, '/x', {}, fake(status, body).impl)).rejects.toMatchObject({ kind });
  });
  test('unreachable → network', async () => {
    const down = (async () => {
      throw new TypeError('Network request failed');
    }) as unknown as typeof fetch;
    await expect(postJson(cfg, '/x', {}, down)).rejects.toMatchObject({ kind: 'network' });
  });
});

