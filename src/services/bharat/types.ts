// BharatConnect provider contracts.
//
// The Voice / Translate / Camera tabs only ever talk to these interfaces, never
// to a vendor. Swapping the mock engine for Gnani (STT / TTS), IndicTrans2 or
// an LLM later means writing one class per interface and changing
// `providers.ts` — no screen needs to change.

/** Pseudo language code meaning "work out the source language yourself". */
export const AUTO_LANG = 'auto';

export interface TranslateRequest {
  readonly text: string;
  /** BCP-47 short code, or AUTO_LANG. */
  readonly sourceLang: string;
  readonly targetLang: string;
}

export interface TranslateResult {
  readonly text: string;
  /** Set when the engine detected the source language (always for AUTO_LANG). */
  readonly detectedLang?: string;
}

export interface TranslateProvider {
  /** Shown in the UI so nobody mistakes the demo engine for the real one. */
  readonly name: string;
  readonly isMock: boolean;
  translate(req: TranslateRequest): Promise<TranslateResult>;
}

export interface SttResult {
  readonly text: string;
  /** Language the engine believes was spoken. */
  readonly lang: string;
  /** 0..1 when the engine reports it; the correction layer uses it later. */
  readonly confidence?: number;
}

/** Manual tap-to-speak: start() on the first tap, stop() on the second. */
export interface SttProvider {
  readonly name: string;
  readonly isMock: boolean;
  start(lang: string): Promise<void>;
  stop(): Promise<SttResult>;
  cancel(): void;
}

/** One run of text found in a photo, in photo-pixel coordinates. */
export interface OcrBlock {
  readonly text: string;
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export type OcrOutcome =
  | { readonly kind: 'ok'; readonly blocks: readonly OcrBlock[] }
  /** The engine cannot read this script (yet). `lang` is what was asked for. */
  | { readonly kind: 'unsupported'; readonly lang: string }
  /** The native OCR module is not installed in this build. */
  | { readonly kind: 'unavailable' };

/** Reads text out of a photo. `sourceLang` may be AUTO_LANG. */
export interface OcrProvider {
  readonly name: string;
  recognize(photoUri: string, sourceLang: string): Promise<OcrOutcome>;
}
