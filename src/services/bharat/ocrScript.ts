// Which on-device OCR script model can read a given language.
//
// Google ML Kit text recognition (v2) ships exactly five script models:
// Latin, Devanagari, Chinese, Japanese, Korean. Everything else — Tamil,
// Telugu, Kannada, Malayalam, Bengali, Gujarati, Punjabi, Odia, Assamese, Urdu,
// Arabic, Thai … — is NOT readable on-device and needs a cloud OCR.

import { AUTO_LANG } from './types';

export type OcrScript = 'latin' | 'devanagari' | 'chinese' | 'japanese' | 'korean';

const LATIN = new Set([
  'en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'pl', 'cs', 'tr', 'vi', 'id',
  'sv', 'no', 'da', 'fi', 'ro', 'hu', 'sw', 'hi-hinglish',
]);
const DEVANAGARI = new Set(['hi', 'mr']);

/**
 * Scripts to try for `lang`, in order. `[]` means "no on-device model" and the
 * caller must say so instead of silently returning nothing. AUTO_LANG tries
 * the two scripts most signs and packaging in India use.
 */
export function ocrScriptsFor(lang: string): readonly OcrScript[] {
  if (lang === AUTO_LANG) return ['latin', 'devanagari'];
  if (LATIN.has(lang)) return ['latin'];
  if (DEVANAGARI.has(lang)) return ['devanagari'];
  if (lang === 'zh') return ['chinese'];
  if (lang === 'ja') return ['japanese'];
  if (lang === 'ko') return ['korean'];
  return [];
}
