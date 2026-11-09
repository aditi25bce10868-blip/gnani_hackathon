import { HttpTranslateProvider } from '../httpProviders';
import { AUTO_LANG } from '../types';

const cfg = { baseUrl: 'https://api.test/', appToken: 'tok', timeoutMs: 50 };

function fake(status: number, body: unknown) {
  const fn = jest.fn(async (_url: string, _init: RequestInit) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }));
  return { fn, impl: fn as unknown as typeof fetch };
}

describe('HttpTranslateProvider', () => {
  test('posts to /translate with the token and returns the text', async () => {
    const f = fake(200, { text: 'धन्यवाद' });
    const p = new HttpTranslateProvider(cfg, f.impl);
    const r = await p.translate({ text: 'Thank you', sourceLang: 'en', targetLang: 'hi' });
    expect(r).toEqual({ text: 'धन्यवाद', detectedLang: 'en' });
    const [url, init] = f.fn.mock.calls[0];
    expect(url).toBe('https://api.test/translate');
    expect((init.headers as Record<string, string>)['x-app-token']).toBe('tok');
    expect(JSON.parse(String(init.body))).toEqual({ text: 'Thank you', source: 'en', target: 'hi' });
  });

  test('auto source: detected language comes from the script', async () => {
    const p = new HttpTranslateProvider(cfg, fake(200, { text: 'Thank you' }).impl);
    const r = await p.translate({ text: 'धन्यवाद', sourceLang: AUTO_LANG, targetLang: 'en' });
    expect(r.detectedLang).toBe('hi');
  });

  test('identical requests are served from the cache (no second call)', async () => {
    const f = fake(200, { text: 'x' });
    const p = new HttpTranslateProvider(cfg, f.impl);
    const req = { text: 'hello', sourceLang: 'en', targetLang: 'ta' };
    await p.translate(req);
    await p.translate(req);
    expect(f.fn).toHaveBeenCalledTimes(1);
  });

  test.each([
    [401, /app token/i],
    [429, /too many/i],
    [500, /problem/i],
  ])('status %i gives a readable message', async (status, msg) => {
    const p = new HttpTranslateProvider(cfg, fake(status, {}).impl);
    await expect(p.translate({ text: 'a', sourceLang: 'en', targetLang: 'hi' })).rejects.toThrow(msg);
  });

  test('network failure and timeout are told apart', async () => {
    const down = (async () => { throw new Error('offline'); }) as unknown as typeof fetch;
    await expect(
      new HttpTranslateProvider(cfg, down).translate({ text: 'a', sourceLang: 'en', targetLang: 'hi' }),
    ).rejects.toThrow(/reach/i);

    const hang = ((_u: string, init: RequestInit) =>
      new Promise((_res, rej) => {
        init.signal?.addEventListener('abort', () => rej(Object.assign(new Error('abort'), { name: 'AbortError' })));
      })) as unknown as typeof fetch;
    await expect(
      new HttpTranslateProvider(cfg, hang).translate({ text: 'a', sourceLang: 'en', targetLang: 'hi' }),
    ).rejects.toThrow(/too long/i);
  });

  test('translateMany sends ONE request and checks the length', async () => {
    const f = fake(200, { texts: ['Exit', 'Open'] });
    const p = new HttpTranslateProvider(cfg, f.impl);
    expect(await p.translateMany(['बाहर', 'खुला'], 'hi', 'en')).toEqual(['Exit', 'Open']);
    expect(f.fn).toHaveBeenCalledTimes(1);
    const wrong = new HttpTranslateProvider(cfg, fake(200, { texts: ['only one'] }).impl);
    await expect(wrong.translateMany(['a', 'b'], 'en', 'hi')).rejects.toThrow(/unexpected/i);
  });
});

describe('HttpTranslateProvider · Converse extras', () => {
  test('context and the mixed-speech hint are sent as "context" and "mix"', async () => {
    const f = fake(200, { text: 'ok' });
    const p = new HttpTranslateProvider(cfg, f.impl);
    await p.translate({
      text: 'मैं tomorrow आऊँगा',
      sourceLang: 'hi',
      targetLang: 'en',
      context: ['English: Will you come?'],
      sourceMix: ['en'],
    });
    expect(JSON.parse(String(f.fn.mock.calls[0][1].body))).toEqual({
      text: 'मैं tomorrow आऊँगा',
      source: 'hi',
      target: 'en',
      context: ['English: Will you come?'],
      mix: ['en'],
    });
  });

  test('empty context / no mix → the body is exactly the plain one', async () => {
    const f = fake(200, { text: 'ok' });
    await new HttpTranslateProvider(cfg, f.impl).translate({
      text: 'a',
      sourceLang: 'en',
      targetLang: 'hi',
      context: [],
      sourceMix: [],
    });
    expect(JSON.parse(String(f.fn.mock.calls[0][1].body))).toEqual({ text: 'a', source: 'en', target: 'hi' });
  });

  test('a reply that depended on context is never cached', async () => {
    const f = fake(200, { text: 'ok' });
    const p = new HttpTranslateProvider(cfg, f.impl);
    const req = { text: 'yes', sourceLang: 'en', targetLang: 'hi', context: ['Hindi: क्या आप आएँगे?'] };
    await p.translate(req);
    await p.translate(req);
    expect(f.fn).toHaveBeenCalledTimes(2);
  });

  test('the same words with a different mix are different cache entries', async () => {
    const f = fake(200, { text: 'ok' });
    const p = new HttpTranslateProvider(cfg, f.impl);
    await p.translate({ text: 'hello', sourceLang: 'hi', targetLang: 'en' });
    await p.translate({ text: 'hello', sourceLang: 'hi', targetLang: 'en', sourceMix: ['en'] });
    expect(f.fn).toHaveBeenCalledTimes(2);
  });
});

