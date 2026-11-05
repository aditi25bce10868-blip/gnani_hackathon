// The single switchboard for BharatConnect's Voice / Translate / Camera tabs.
// When the Gnani STT/TTS and the translation + context layers are ready,
// implement `SttProvider` / `TranslateProvider` and swap the two lines below.
// (Converse and Hands-free still run on Parly's own pipeline — that swap lives
// in services/pipeline/orchestrator.ts and is a separate step.)

import { MockSttProvider, MockTranslateProvider } from './mockProviders';
import { MlKitOcrProvider } from './mlkitOcr';
import type { OcrProvider, SttProvider, TranslateProvider } from './types';

export const translateProvider: TranslateProvider = new MockTranslateProvider();

/** Camera tab. On-device ML Kit covers Latin + Devanagari + CJK; add a cloud
 *  provider here for Tamil / Telugu / Bengali / … (see mlkitOcr.ts). */
export const ocrProvider: OcrProvider = new MlKitOcrProvider();

export function createSttProvider(): SttProvider {
  return new MockSttProvider();
}
