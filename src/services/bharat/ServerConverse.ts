// ServerConverse — the Converse tab's push-to-talk turn on the BharatConnect
// server (Gnani listens, Qwen translates, Gnani speaks).
//
//   hold → record WAV → release → /stt → /translate (with the last few turns) → speak
//
// It writes the same conversationStore turns the Parly orchestrator does, so
// SpeakerHalf, the haptics and the notices work unchanged. Hands-free still runs
// on Parly's orchestrator (its own, separate step).
//
// Everything it touches is injected, so tests never record, fetch or speak.

import { getLanguage } from '../../app/languages';
import type { PersonId } from '../../app/types';
import type { NoticeKey, Turn, useConversationStore } from '../../store/conversationStore';
import { ServerError } from './serverApi';
import { mixFor } from './mixedSpeech';
import type { TranslateRequest, TranslateResult } from './types';

export interface ConverseTurnArgs {
  readonly speakerId: PersonId;
  readonly sourceLang: string;
  readonly targetLang: string;
}

interface Capture {
  hasPermission(): Promise<boolean>;
  requestPermission(): Promise<boolean>;
  start(): void;
  stop(): Promise<string>;
  readonly isRecording: boolean;
}

export type SpeakResult = 'spoken' | 'no-voice' | 'error' | 'skipped';

export interface ConverseDeps {
  readonly capture: Capture;
  readonly readBase64: (path: string) => Promise<string>;
  readonly transcribe: (wavBase64: string, lang: string, opts: { mix: readonly string[] }) => Promise<string>;
  readonly translate: (req: TranslateRequest) => Promise<TranslateResult>;
  readonly speak: (text: string, lang: string) => Promise<SpeakResult>;
  readonly stopSpeaking: () => void;
  readonly store: typeof useConversationStore;
  /** Read at every turn, so flipping the Mix switch takes effect immediately. */
  readonly mixedSpeech: () => boolean;
  readonly log?: { info(m: string): void; warn(m: string): void };
  readonly sleep?: (ms: number) => Promise<void>;
}

/** Grace after release — people let go ON the last syllable. */
const RELEASE_HANGOVER_MS = 250;
/** 16 kHz · mono · 16-bit = 32 000 bytes/s. Under 0.25 s is a mis-tap. */
const MIN_BYTES = 8_000;
/** Gnani accepts 30 s; the worker 40 s. Stop on our own just before. */
const MAX_BYTES = 960_000;
const MAX_RECORD_MS = 28_000;
/** Earlier turns the translator may read for context. */
const CONTEXT_TURNS = 3;

type State = 'idle' | 'recording' | 'working';

function turnId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** Which notice a failure deserves. Raw text stays in the log. */
export function noticeFor(err: unknown): NoticeKey {
  if (err instanceof ServerError) {
    if (err.kind === 'network' || err.kind === 'timeout') return 'connectionDropped';
    if (err.kind === 'rate_limited') return 'rateLimit';
  }
  return 'generic';
}

export class ServerConverse {
  private state: State = 'idle';
  private beginning = false;
  private run = 0;
  private turn: { id: string; args: ConverseTurnArgs } | null = null;
  private maxTimer: ReturnType<typeof setTimeout> | null = null;
  private done: (() => void) | null = null;

  constructor(private readonly d: ConverseDeps) {}

  private sleep(ms: number): Promise<void> {
    return this.d.sleep ? this.d.sleep(ms) : new Promise(r => setTimeout(r, ms));
  }

  /** Starts recording. Resolves when the whole turn (listen, translate, speak) is over. */
  async beginTurn(args: ConverseTurnArgs): Promise<void> {
    if (this.state !== 'idle' || this.beginning) return;
    const store = this.d.store.getState();
    store.setNotice(args.speakerId, null);

    // Permission is asked lazily, in context. If a dialog appeared, this press
    // has physically ended under it, so we do not record on it: grant means the
    // NEXT press works.
    this.beginning = true;
    try {
      let granted: boolean;
      try {
        granted = await this.d.capture.hasPermission();
      } catch {
        granted = true;
      }
      if (!granted) {
        const now = await this.d.capture.requestPermission().catch(() => false);
        if (!now) store.setNotice(args.speakerId, { key: 'micPermission', kind: 'info' });
        return;
      }
    } finally {
      this.beginning = false;
    }

    const id = turnId();
    const run = ++this.run;
    store.startTurn({
      id,
      speakerId: args.speakerId,
      sourceLang: args.sourceLang,
      targetLang: args.targetLang,
      sourceText: '',
      translatedText: '',
      stage: 'recording',
      startedAt: Date.now(),
    });
    this.turn = { id, args };
    this.state = 'recording';
    const finished = new Promise<void>(resolve => {
      this.done = resolve;
    });

    try {
      this.d.capture.start();
    } catch (e) {
      this.d.log?.warn(`[converse] capture failed: ${String(e)}`);
      this.fail(run, id, args, 'generic', String(e));
      return finished;
    }
    // A hold that outlasts what the server accepts is ended for the speaker.
    this.maxTimer = setTimeout(() => void this.endTurn(), MAX_RECORD_MS);
    return finished;
  }

  /** Release of the disc: listen → translate → speak. */
  async endTurn(): Promise<void> {
    if (this.state !== 'recording' || !this.turn) return;
    this.clearTimer();
    this.state = 'working';
    const { id, args } = this.turn;
    const run = this.run;
    const store = this.d.store.getState();
    store.updateTurn(id, { stage: 'transcribing' });

    try {
      await this.sleep(RELEASE_HANGOVER_MS);
      if (run !== this.run) return;
      const path = await this.d.capture.stop();
      const b64 = await this.d.readBase64(path);
      if (run !== this.run) return;

      const bytes = Math.floor((b64.length * 3) / 4);
      if (bytes < MIN_BYTES) return this.finishQuietly(run, id, args.speakerId, 'didntCatch');
      if (bytes > MAX_BYTES) return this.fail(run, id, args, 'generic', 'recording too long');

      const mix = mixFor(args.sourceLang, this.d.mixedSpeech());
      const heard = (await this.d.transcribe(b64, args.sourceLang, { mix })).trim();
      if (run !== this.run) return;
      if (heard === '') return this.finishQuietly(run, id, args.speakerId, 'didntCatch');
      this.d.store.getState().updateTurn(id, { sourceText: heard, stage: 'translating' });

      const out = await this.d.translate({
        text: heard,
        sourceLang: args.sourceLang,
        targetLang: args.targetLang,
        context: this.contextLines(id),
        sourceMix: mix.length > 0 ? mix : undefined,
      });
      if (run !== this.run) return;
      // Show the translation the moment it exists — the voice follows.
      this.d.store.getState().updateTurn(id, { translatedText: out.text, stage: 'speaking' });

      const outcome = await this.d.speak(out.text, args.targetLang);
      if (run !== this.run) return;
      const store2 = this.d.store.getState();
      if (outcome === 'no-voice') {
        const listener: PersonId = args.speakerId === 'person_a' ? 'person_b' : 'person_a';
        store2.setNotice(listener, { key: 'noVoice', kind: 'info', lang: args.targetLang });
      }
      store2.endTurn(id, { stage: 'done' });
      this.release(run);
    } catch (e) {
      if (run !== this.run) return;
      this.d.log?.warn(`[converse] turn failed: ${e instanceof Error ? e.message : String(e)}`);
      this.fail(run, id, args, noticeFor(e), e instanceof Error ? e.message : String(e));
    }
  }

  /** The speaker's own act (tapping the reading, leaving the app): stop quietly. */
  async cancelTurn(): Promise<void> {
    if (this.state === 'idle' || !this.turn) return;
    const { id } = this.turn;
    this.run += 1; // anything still in flight is now stale
    this.clearTimer();
    if (this.d.capture.isRecording) await this.d.capture.stop().catch(() => '');
    this.d.stopSpeaking();
    this.d.store.getState().endTurn(id, { stage: 'done' });
    this.reset();
  }

  // ── internals ────────────────────────────────────────────────────────────

  /** The last few finished turns, as "Language: words" — for the translator only. */
  private contextLines(currentId: string): string[] {
    return this.d.store
      .getState()
      .turns.filter((t: Turn) => t.id !== currentId && t.stage === 'done' && t.sourceText.trim() !== '')
      .slice(-CONTEXT_TURNS)
      .map((t: Turn) => `${getLanguage(t.sourceLang).name}: ${t.sourceText.trim()}`);
  }

  private finishQuietly(run: number, id: string, speaker: PersonId, key: NoticeKey): void {
    if (run !== this.run) return;
    const store = this.d.store.getState();
    store.setNotice(speaker, { key, kind: 'info' });
    store.endTurn(id, { stage: 'done' });
    this.release(run);
  }

  private fail(run: number, id: string, args: ConverseTurnArgs, key: NoticeKey, message: string): void {
    if (run !== this.run) return;
    this.clearTimer();
    if (this.d.capture.isRecording) void this.d.capture.stop().catch(() => '');
    const store = this.d.store.getState();
    store.setNotice(args.speakerId, { key, kind: 'error' });
    store.endTurn(id, { stage: 'error', errorMessage: message });
    this.release(run);
  }

  private release(run: number): void {
    if (run === this.run) this.reset();
  }

  private reset(): void {
    this.state = 'idle';
    this.turn = null;
    const done = this.done;
    this.done = null;
    done?.();
  }

  private clearTimer(): void {
    if (this.maxTimer !== null) clearTimeout(this.maxTimer);
    this.maxTimer = null;
  }
}
