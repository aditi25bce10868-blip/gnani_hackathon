// Mixed (code-mixed) speech — Hindi + English, Tamil + English, …
//
// Gnani's Prisma v3.0 can listen for several languages at once and writes the
// result so English words stay in Latin letters. The Converse tab asks for it
// by sending the speaker's language plus `mix` languages to the server.
//
// English itself needs no hint (Gnani's English model already accepts
// English–Hindi mixed audio), and Hinglish is heard as Romanised text by
// definition, so neither gets a `mix`.

/** Gnani languages that are commonly spoken mixed with English. */
const MIXABLE: ReadonlySet<string> = new Set(['hi', 'bn', 'mr', 'gu', 'pa', 'ta', 'te', 'kn', 'ml']);

/** Languages to hear together with `lang`; empty when mixing is off or n/a. */
export function mixFor(lang: string, enabled: boolean): readonly string[] {
  return enabled && MIXABLE.has(lang) ? ['en'] : [];
}

/** Whether the Mix switch means anything for this pair of languages. */
export function pairCanMix(a: string, b: string): boolean {
  return MIXABLE.has(a) || MIXABLE.has(b);
}
