// The single switchboard for BharatConnect's Voice / Translate / Camera tabs.
// When the Gnani STT/TTS and the translation + context layers are ready,
// implement `SttProvider` / `TranslateProvider` and swap the two lines below.
// (Converse and Hands-free still run on Parly's own pipeline — that swap lives
// in services/pipeline/orchestrator.ts and is a separate step.)

import { BHARAT_API } from './config';
import { HttpTranslateProvider } from './httpProviders';
import { MockSttProvider, MockTranslateProvider } from './mockProviders';
import { ServerSttProvider } from './serverStt';
import { MlKitOcrProvider } from './mlkitOcr';
import type { OcrProvider, SttProvider, TranslateProvider } from './types';

/** Real engine once the server is configured (config.ts), demo engine until then. */
export const translateProvider: TranslateProvider =
  BHARAT_API.baseUrl !== ''
    ? new HttpTranslateProvider(BHARAT_API)
    : new MockTranslateProvider();

/** Camera tab. On-device ML Kit covers Latin + Devanagari + CJK; add a cloud
 *  provider here for Tamil / Telugu / Bengali / … (see mlkitOcr.ts). */
export const ocrProvider: OcrProvider = new MlKitOcrProvider();

export function createSttProvider(): SttProvider {
  return BHARAT_API.baseUrl !== '' ? new ServerSttProvider(BHARAT_API) : new MockSttProvider();
}
