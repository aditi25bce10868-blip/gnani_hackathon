// Script-based language guess. Deterministic and offline: good enough for the
// Translate tab's "Detect language" until the real engine reports one. It
// cannot tell Hinglish from English (both Latin), nor Marathi from Hindi
// (both Devanagari) — the real engine should override it.

interface ScriptRange {
  readonly code: string;
  readonly from: number;
  readonly to: number;
}

const RANGES: readonly ScriptRange[] = [
  { code: 'hi', from: 0x0900, to: 0x097f }, // Devanagari
  { code: 'bn', from: 0x0980, to: 0x09ff }, // Bengali
  { code: 'pa', from: 0x0a00, to: 0x0a7f }, // Gurmukhi
  { code: 'gu', from: 0x0a80, to: 0x0aff }, // Gujarati
  { code: 'or', from: 0x0b00, to: 0x0b7f }, // Odia
  { code: 'ta', from: 0x0b80, to: 0x0bff }, // Tamil
  { code: 'te', from: 0x0c00, to: 0x0c7f }, // Telugu
  { code: 'kn', from: 0x0c80, to: 0x0cff }, // Kannada
  { code: 'ml', from: 0x0d00, to: 0x0d7f }, // Malayalam
  { code: 'ur', from: 0x0600, to: 0x06ff }, // Arabic script
];

/** Best-guess language of `text`, or '' when there is nothing to go on. */
export function detectLanguage(text: string): string {
  const counts = new Map<string, number>();
  let latin = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    const hit = RANGES.find(r => cp >= r.from && cp <= r.to);
    if (hit) counts.set(hit.code, (counts.get(hit.code) ?? 0) + 1);
    else if ((cp >= 0x41 && cp <= 0x5a) || (cp >= 0x61 && cp <= 0x7a)) latin += 1;
  }
  let best = '';
  let bestCount = latin;
  if (latin > 0) best = 'en';
  for (const [code, n] of counts) {
    if (n > bestCount) {
      best = code;
      bestCount = n;
    }
  }
  return best;
}
