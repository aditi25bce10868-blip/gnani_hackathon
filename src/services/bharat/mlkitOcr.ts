// On-device OCR via Google ML Kit (npm: @react-native-ml-kit/text-recognition).
//
// The package is required lazily inside try/catch, so the app still builds and
// runs before it is installed — the Camera tab then reports 'unavailable'
// instead of crashing. Install:  npm i @react-native-ml-kit/text-recognition
//
// To read Tamil / Telugu / Bengali / … add a CloudOcrProvider (BharatConnect / cloud OCR or
// Google Cloud Vision) and have `recognize` fall back to it when
// `ocrScriptsFor(lang)` is empty.

import { ocrScriptsFor, type OcrScript } from './ocrScript';
import type { OcrBlock, OcrOutcome, OcrProvider } from './types';

interface MlKitBlock {
  readonly text?: string;
  readonly frame?: { left: number; top: number; width: number; height: number };
}
interface MlKitModule {
  readonly default: {
    recognize(uri: string, script?: string): Promise<{ readonly blocks?: readonly MlKitBlock[] }>;
  };
  readonly TextRecognitionScript?: Record<string, string>;
}

function load(): MlKitModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@react-native-ml-kit/text-recognition') as MlKitModule;
  } catch {
    return null;
  }
}

const ENUM_KEY: Record<OcrScript, string> = {
  latin: 'LATIN',
  devanagari: 'DEVANAGARI',
  chinese: 'CHINESE',
  japanese: 'JAPANESE',
  korean: 'KOREAN',
};

function toBlocks(raw: readonly MlKitBlock[] | undefined): OcrBlock[] {
  const out: OcrBlock[] = [];
  for (const b of raw ?? []) {
    const text = (b.text ?? '').trim();
    if (text === '' || !b.frame) continue;
    out.push({ text, left: b.frame.left, top: b.frame.top, width: b.frame.width, height: b.frame.height });
  }
  return out;
}

const charCount = (blocks: readonly OcrBlock[]): number => blocks.reduce((n, b) => n + b.text.length, 0);

export class MlKitOcrProvider implements OcrProvider {
  readonly name = 'ML Kit (on-device)';

  async recognize(photoUri: string, sourceLang: string): Promise<OcrOutcome> {
    const mod = load();
    if (!mod) return { kind: 'unavailable' };
    const scripts = ocrScriptsFor(sourceLang);
    if (scripts.length === 0) return { kind: 'unsupported', lang: sourceLang };

    // Auto mode runs more than one script model; keep whichever read more.
    let best: OcrBlock[] = [];
    for (const script of scripts) {
      const enumVal = mod.TextRecognitionScript?.[ENUM_KEY[script]];
      const res = await mod.default.recognize(photoUri, enumVal);
      const blocks = toBlocks(res.blocks);
      if (charCount(blocks) > charCount(best)) best = blocks;
    }
    return { kind: 'ok', blocks: best };
  }
}
