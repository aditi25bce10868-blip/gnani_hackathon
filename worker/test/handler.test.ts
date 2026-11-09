/** @jest-environment node */
import { handle, type Env } from '../src/handler';
import { buildMessages, cleanOutput, parseBatch } from '../src/prompt';
import { describe, test, expect } from "vitest";

const env: Env = { GROQ_API_KEY: 'gk', APP_TOKEN: 'tok' };

function req(path: string, body?: unknown, token: string | null = 'tok', method = 'POST'): Request {
  return new Request(`https://w.test${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token === null ? {} : { 'x-app-token': token }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function groq(content: string, status = 200, headers: Record<string, string> = {}) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fn = async (url: string, init: RequestInit): Promise<Response> => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status, headers });
  };
  return { fn, calls };
}

describe('auth and routing', () => {
  test('health is open', async () => {
    const r = await handle(req('/health', undefined, null, 'GET'), env, groq('').fn);
    expect(r.status).toBe(200);
  });
  test('missing or wrong token → 401, and nothing is sent upstream', async () => {
    const g = groq('x');
    expect((await handle(req('/translate', { text: 'a', target: 'en' }, null), env, g.fn)).status).toBe(401);
    expect((await handle(req('/translate', { text: 'a', target: 'en' }, 'nope'), env, g.fn)).status).toBe(401);
    expect(g.calls).toHaveLength(0);
  });
  test('an empty configured token never authorises', async () => {
    const r = await handle(req('/translate', { text: 'a', target: 'en' }, ''), { ...env, APP_TOKEN: '' }, groq('x').fn);
    expect(r.status).toBe(401);
  });
  test('unknown paths 404', async () => {
    expect((await handle(req('/nope', {}), env, groq('').fn)).status).toBe(404);
  });
});

describe('/translate single', () => {
  test('returns the cleaned text and calls Groq with thinking off', async () => {
    const g = groq('<think>hmm</think>  धन्यवाद  ');
    const r = await handle(req('/translate', { text: 'Thank you', source: 'en', target: 'hi' }), env, g.fn);
    expect(await r.json()).toEqual({ text: 'धन्यवाद' });
    const sent = JSON.parse(String(g.calls[0].init.body));
    expect(sent.model).toBe('qwen/qwen3.8-27b');
    expect(sent.reasoning_effort).toBe('none');
    expect(sent.messages[0].content).toContain('Hindi');
    expect(sent.messages[1].content).toBe('Thank you');
    expect((g.calls[0].init.headers as Record<string, string>).authorization).toBe('Bearer gk');
  });
  test('auto source asks the model to detect', () => {
    const m = buildMessages({ texts: ['x'], source: 'auto', target: 'ta', context: [] });
    expect(m[0].content).toContain('Detect the source language');
    expect(m[0].content).toContain('Tamil');
  });
  test('context is passed on, capped at 6 turns', async () => {
    const g = groq('ok');
    const ctx = Array.from({ length: 9 }, (_, i) => `turn${i}`);
    await handle(req('/translate', { text: 'a', target: 'en', context: ctx }), env, g.fn);
    const sys = JSON.parse(String(g.calls[0].init.body)).messages[0].content as string;
    expect(sys).toContain('turn8');
    expect(sys).not.toContain('turn2');
  });
  test.each([
    [{ target: 'en' }],
    [{ text: 'a' }],
    [{ text: 'a', target: 'auto' }],
    [{ text: '   ', target: 'en' }],
    [{ text: 'x'.repeat(2001), target: 'en' }],
  ])('rejects bad input #%#', async body => {
    const g = groq('x');
    expect((await handle(req('/translate', body), env, g.fn)).status).toBe(400);
    expect(g.calls).toHaveLength(0);
  });
  test('invalid JSON → 400', async () => {
    const r = new Request('https://w.test/translate', { method: 'POST', headers: { 'x-app-token': 'tok' }, body: '{' });
    expect((await handle(r, env, groq('x').fn)).status).toBe(400);
  });
});

describe('/translate mixed speech', () => {
  test('mix tells the model the source is code-mixed', async () => {
    const g = groq('I am going to the office tomorrow');
    const r = await handle(
      req('/translate', { text: 'मैं tomorrow office जा रहा हूँ', source: 'hi', target: 'en', mix: ['en'] }),
      env,
      g.fn,
    );
    expect(await r.json()).toEqual({ text: 'I am going to the office tomorrow' });
    const sys = (JSON.parse(String(g.calls[0].init.body)) as { messages: { content: string }[] }).messages[0].content;
    expect(sys).toContain('Source language: Hindi.');
    expect(sys).toContain('mixes English words');
  });

  test('without mix the prompt is unchanged', () => {
    const [sys] = buildMessages({ texts: ['a'], source: 'hi', target: 'en', context: [] });
    expect(sys.content).not.toContain('mixes');
  });

  test('Hinglish as a target tells the model how to write it', () => {
    const [sys] = buildMessages({ texts: ['Where is the station?'], source: 'en', target: 'hi-hinglish', context: [] });
    expect(sys.content).toContain('Roman script');
    expect(sys.content).toContain('English');
  });
});

describe('/translate batch', () => {
  test('one upstream call for the whole batch', async () => {
    const g = groq('{"translations":["Exit","Open"]}');
    const r = await handle(req('/translate', { texts: ['बाहर','खुला'], source: 'hi', target: 'en' }), env, g.fn);
    expect(await r.json()).toEqual({ texts: ['Exit', 'Open'] });
    expect(g.calls).toHaveLength(1);
    expect(JSON.parse(String(g.calls[0].init.body)).response_format).toEqual({ type: 'json_object' });
  });
  test('a one-item batch (a photo with a single text block) still gets JSON prompt and JSON reply', async () => {
    const g = groq('{"translations":["Exit"]}');
    const r = await handle(req('/translate', { texts: ['बाहर'], source: 'hi', target: 'en' }), env, g.fn);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ texts: ['Exit'] });
    const sys = JSON.parse(String(g.calls[0].init.body)).messages[0].content as string;
    expect(sys).toContain('translations');
  });
  test('a reply with the wrong length is rejected, not guessed at', async () => {
    const r = await handle(req('/translate', { texts: ['a', 'b'], target: 'en' }), env, groq('{"translations":["x"]}').fn);
    expect(r.status).toBe(502);
  });
  test('too many items → 400', async () => {
    const r = await handle(req('/translate', { texts: Array(41).fill('a'), target: 'en' }), env, groq('').fn);
    expect(r.status).toBe(400);
  });
  test('parseBatch', () => {
    expect(parseBatch('{"translations":["a","b"]}', 2)).toEqual(['a', 'b']);
    expect(parseBatch('{"translations":["a",1]}', 2)).toBeNull();
    expect(parseBatch('nope', 1)).toBeNull();
  });
});

describe('upstream failures', () => {
  test('429 is passed on with retry-after', async () => {
    const r = await handle(req('/translate', { text: 'a', target: 'en' }), env, groq('', 429, { 'retry-after': '12' }).fn);
    expect(r.status).toBe(429);
    expect(r.headers.get('retry-after')).toBe('12');
  });
  test('other upstream errors → 502, network failure → 502', async () => {
    expect((await handle(req('/translate', { text: 'a', target: 'en' }), env, groq('', 500).fn)).status).toBe(502);
    const boom = async (): Promise<Response> => { throw new Error('down'); };
    expect((await handle(req('/translate', { text: 'a', target: 'en' }), env, boom)).status).toBe(502);
  });
  test('empty model output → 502', async () => {
    expect((await handle(req('/translate', { text: 'a', target: 'en' }), env, groq('<think>x</think>').fn)).status).toBe(502);
  });
  test('cleanOutput strips multi-line thinking', () => {
    expect(cleanOutput('<think>a\nb</think>\nhello')).toBe('hello');
  });
});