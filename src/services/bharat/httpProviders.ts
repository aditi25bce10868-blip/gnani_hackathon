// Translation through the BharatConnect server (Worker → Groq → Qwen3.8).

import { detectLanguage } from './scriptDetect';
import { ServerError, postJson, type ServerConfig } from './serverApi';
import {
  AUTO_LANG,
  type TranslateProvider,
  type TranslateRequest,
  type TranslateResult,
} from './types';

export type HttpConfig = ServerConfig;

const CACHE_MAX = 200;

export class HttpTranslateProvider implements TranslateProvider {
  readonly name = 'Qwen3.8 · BharatConnect server';
  readonly isMock = false;

  private readonly cache = new Map<string, TranslateResult>();

  constructor(
    private readonly cfg: HttpConfig,
    private readonly fetchImpl: typeof fetch = (...a) => fetch(...a),
  ) {}

  async translate(req: TranslateRequest): Promise<TranslateResult> {
    const hasContext = (req.context?.length ?? 0) > 0;
    const mix = req.sourceMix ?? [];
    const key = `${req.sourceLang}|${req.targetLang}|${mix.join('+')}|${req.text}`;
    // A reply that depended on earlier turns must not be replayed for the same
    // words in another conversation.
    const hit = hasContext ? undefined : this.cache.get(key);
    if (hit) return hit;

    const payload: Record<string, unknown> = { text: req.text, source: req.sourceLang, target: req.targetLang };
    if (hasContext) payload.context = req.context;
    if (mix.length > 0) payload.mix = mix;
    const body = await this.post(payload);
    const text = typeof body.text === 'string' ? body.text : '';
    if (text === '') throw new ServerError('The server sent back nothing. Try again.');
    // The model does not report the language it detected; the on-device script
    // guess is good enough for the "detected · Hindi" label.
    const detected = req.sourceLang === AUTO_LANG ? detectLanguage(req.text) : req.sourceLang;
    const result: TranslateResult = { text, detectedLang: detected };
    if (!hasContext) this.remember(key, result);
    return result;
  }

  /** One request for many texts that belong together (a camera photo). */
  async translateMany(texts: readonly string[], sourceLang: string, targetLang: string): Promise<string[]> {
    if (texts.length === 0) return [];
    const body = await this.post({ texts, source: sourceLang, target: targetLang });
    const out = body.texts;
    if (!Array.isArray(out) || out.length !== texts.length || !out.every(t => typeof t === 'string')) {
      throw new ServerError('The server sent back an unexpected answer. Try again.');
    }
    return out as string[];
  }

  private remember(key: string, value: TranslateResult): void {
    if (this.cache.size >= CACHE_MAX) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    this.cache.set(key, value);
  }

  private async post(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return postJson(this.cfg, '/translate', payload, this.fetchImpl);
  }
}
