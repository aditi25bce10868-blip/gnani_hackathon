// Who spoke? — direction routing for hands-free on the server.
//
// Two people share the phone, nobody presses anything, so each utterance has to
// say for itself which of them it came from. Gnani is asked to listen for BOTH
// languages at once (the first as the main one, the second as a hint) and tells
// us which it heard (`detected`). The transcript's own script / words are a
// second opinion — and the stronger one, because it is the very text about to
// be translated. Same precedence Parly's Mistral path uses:
//
//   strong text evidence  >  Gnani's `detected`  >  weak text evidence  >  alternate
//
// Alternation (the other person than last time) is the last resort, never a
// reason to drop what somebody said.

import type { PersonId } from '../../app/types';
import { classifyPairText } from '../pipeline/textLangId';
import { SERVER_TTS_LANGS } from './serverVoice';

export type RouteKind = 'text' | 'text-override' | 'audio' | 'fallback';

export interface HfRoute {
  readonly speakerId: PersonId;
  readonly sourceLang: string;
  readonly targetLang: string;
  readonly kind: RouteKind;
}

/** 'hi-IN' → 'hi'; 'hi-hinglish' → 'hi'. */
export function primarySubtag(code: string): string {
  return code.toLowerCase().split('-')[0];
}

/**
 * Whether Gnani can run hands-free for this pair: both languages are Gnani's
 * (so one request can listen for both), and neither is Hinglish — Hinglish and
 * English are both Roman letters, so neither the script nor the transcript can
 * say which of the two people spoke.
 */
export function pairOnServer(a: string, b: string): boolean {
  if (a === '' || b === '' || a === b) return false;
  const ok = (c: string): boolean => SERVER_TTS_LANGS.has(c) && c !== 'hi-hinglish';
  return ok(a) && ok(b);
}

/** Languages to ask Gnani for, as `language` + `mix` of POST /stt. The other
 *  person's language is always a hint; English joins when mixed speech is on
 *  (Hindi speakers say "tomorrow", "office"). */
export function listenSpec(
  a: string,
  b: string,
  mixedSpeech: boolean,
): { readonly language: string; readonly mix: readonly string[] } {
  const mix = [b];
  if (mixedSpeech && a !== 'en' && b !== 'en') mix.push('en');
  return { language: a, mix };
}

export function routeUtterance(
  pairA: string,
  pairB: string,
  detected: string | undefined,
  text: string,
  lastSpeaker: PersonId | null,
): HfRoute {
  const a = primarySubtag(pairA);
  const b = primarySubtag(pairB);
  const asA = (kind: RouteKind): HfRoute => ({ speakerId: 'person_a', sourceLang: pairA, targetLang: pairB, kind });
  const asB = (kind: RouteKind): HfRoute => ({ speakerId: 'person_b', sourceLang: pairB, targetLang: pairA, kind });

  if (a !== b) {
    const dl = detected ? primarySubtag(detected) : null;
    const audioVote: 'a' | 'b' | null = dl === a ? 'a' : dl === b ? 'b' : null;
    const vote = classifyPairText(text, a, b);
    const textSide = vote && (vote.strength === 'strong' || audioVote === null) ? vote.side : null;
    const side = textSide ?? audioVote;
    if (side) {
      const kind: RouteKind = textSide ? (audioVote && audioVote !== textSide ? 'text-override' : 'text') : 'audio';
      return side === 'a' ? asA(kind) : asB(kind);
    }
  }
  return lastSpeaker === 'person_a' ? asB('fallback') : asA('fallback');
}

/** Directions decided without reading the transcript are worth double-checking. */
export function wasGuessed(kind: RouteKind): boolean {
  return kind === 'fallback' || kind === 'audio';
}

const norm = (s: string): string => s.toLowerCase().replace(/[\s\p{P}]+/gu, ' ').trim();

/** A "translation" that is just the input again — the sign the direction was wrong. */
export function returnedItsInput(source: string, translated: string): boolean {
  return norm(source) === norm(translated);
}
