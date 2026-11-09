// ServerHandsFree — the Hands-free tab on the BharatConnect server.
//
//   mic ─► on-device VAD cuts one utterance ─► WAV ─► /stt (Gnani hears BOTH
//   languages, says which) ─► route to a speaker ─► /translate (Qwen, with the
//   last turns as context) ─► /tts (Gnani voice, phone voice as the fallback)
//
// Gnani takes a finished recording, not a stream, so there are no live partials:
// the seam wave breathes while someone talks and while the answer is prepared,
// and the translation appears the moment it exists. Half-duplex, as in Parly:
// the microphone is ignored from the moment an utterance ends until the phone
// has finished speaking, so the phone never transcribes itself.
//
// It writes the same conversationStore turns as the Mistral orchestrator and
// has the same method names, so ConversationScreen drives either one the same way.
// Everything it touches is injected; tests never record, fetch, speak or run ONNX.

import { getLanguage } from '../../app/languages';
import type { PersonId } from '../../app/types';
import { decodePcm16 } from '../audio/pcm';
import { pcmToWavBase64, sampleCount, trimTrailingSilence, WAV_SAMPLE_RATE } from '../audio/wav';
import { resetAudioLevel, publishAudioFrame, frameRms } from '../audio/audioLevelBus';
import type { NoticeKey, Turn, useConversationStore } from '../../store/conversationStore';
import { listenSpec, returnedItsInput, routeUtterance, wasGuessed } from './handsFreeRouting';
import { noticeFor, type SpeakResult } from './ServerConverse';
import { mixFor } from './mixedSpeech';
import type { TranslateRequest, TranslateResult } from './types';

export interface HfCapture {
  hasPermission(): Promise<boolean>;
  requestPermission(): Promise<boolean>;
  startStreaming(onData: (base64Pcm: string) => void): void;
  stopStreaming(): Promise<void>;
}

export interface HfVad {
  initialize(): Promise<void>;
  feedFrame(frame: Int16Array): void;
  subscribe(onSpeechStart: () => void, onSpeechEnd: (lastSpeechAt: number) => void): () => void;
  setActive(active: boolean): void;
  resetState(): void;
  endUtterance(): void;
}

export interface Heard {
  readonly text: string;
  /** Language Gnani says it heard (e.g. "hi-IN"), when it reports one. */
  readonly detected?: string;
}

export interface HandsFreeDeps {
  readonly capture: HfCapture;
  readonly vad: HfVad;
  readonly transcribe: (
    wavBase64: string,
    lang: string,
    opts: { mix: readonly string[] },
  ) => Promise<Heard>;
  readonly translate: (req: TranslateRequest) => Promise<TranslateResult>;
  readonly speak: (text: string, lang: string) => Promise<SpeakResult>;
  readonly stopSpeaking: () => void;
  readonly store: typeof useConversationStore;
  /** Read at every utterance, so the +EN setting takes effect at once. */
  readonly mixedSpeech: () => boolean;
  readonly log?: { info(m: string): void; warn(m: string): void };
  readonly sleep?: (ms: number) => Promise<void>;
  /** Fire-and-forget: opens the connection to the server so the first sentence
   *  does not pay for DNS + TLS. Called when hands-free turns on. */
  readonly warmUp?: () => void;
}

/** Audio kept from BEFORE the VAD noticed speech, so the first syllable survives. */
const PREROLL_SAMPLES = Math.round(WAV_SAMPLE_RATE * 0.5);
/** Shorter than this is a click or a cough, not a sentence. */
const MIN_SAMPLES = Math.round(WAV_SAMPLE_RATE * 0.3);
/** Gnani accepts 30 s; end the utterance ourselves just before. */
const MAX_SAMPLES = WAV_SAMPLE_RATE * 28;
/** After the phone stops speaking, before listening again (its own echo tail). */
const COOLDOWN_MS = 250;
const CONTEXT_TURNS = 3;
const VAD_FRAME = 512;
/** Wedged-inference guard, as in the orchestrator: never buffer more than ~2 s. */
const MAX_VAD_BUFFER = VAD_FRAME * 64;

type State = 'idle' | 'capturing' | 'working' | 'cooldown';

function turnId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export class ServerHandsFree {
  private enabled = false;
  private paused = false;
  private state: State = 'idle';
  private run = 0;
  private pair: { a: string; b: string } | null = null;
  private unsubVad: (() => void) | null = null;
  private preroll: Int16Array[] = [];
  private prerollSamples = 0;
  private utterance: Int16Array[] = [];
  private utteranceSamples = 0;
  private vadBuffer = new Int16Array(0);
  private currentTurnId: string | null = null;
  private skipRequested = false;

  constructor(private readonly d: HandsFreeDeps) {}

  // ── the same surface the orchestrator has ───────────────────────────────

  isHandsFreeActive(): boolean {
    return this.enabled;
  }

  isHandsFreePaused(): boolean {
    return this.paused;
  }

  async enableHandsFree(pairA: string, pairB: string): Promise<void> {
    if (this.enabled) return;
    const store = this.d.store.getState();

    // Native recording without the permission can end the process outright, so
    // it is settled BEFORE anything flips. The toggle tap survives a dialog, so
    // a grant continues straight into hands-free.
    let granted: boolean;
    try {
      granted = await this.d.capture.hasPermission();
    } catch {
      granted = true;
    }
    if (!granted) granted = await this.d.capture.requestPermission().catch(() => false);
    if (!granted) {
      store.setNotice('person_a', { key: 'micPermission', kind: 'info' });
      store.setNotice('person_b', { key: 'micPermission', kind: 'info' });
      return;
    }

    this.pair = { a: pairA, b: pairB };
    this.enabled = true;
    this.paused = false;
    this.resetBuffers();
    this.state = 'idle';
    this.setActivity('idle');
    store.setNotice('person_a', null);
    store.setNotice('person_b', null);
    store.setMode('hf');
    this.d.log?.info(`[hf-server] enabling ${pairA}↔${pairB}`);
    try {
      this.d.warmUp?.();
    } catch {
      // a failed warm-up must never stop hands-free
    }

    try {
      await this.d.vad.initialize();
      try {
        await this.d.capture.stopStreaming();
      } catch {
        // nothing was running
      }
      this.d.capture.startStreaming(this.onAudio);
      this.unsubVad = this.d.vad.subscribe(
        () => this.onSpeechStart(),
        () => void this.onSpeechEnd(),
      );
      this.d.vad.resetState();
      this.d.vad.setActive(true);
    } catch (e) {
      // Leave nothing half-on: a failed start must not look like a working one.
      this.d.log?.warn(`[hf-server] could not start: ${e instanceof Error ? e.message : String(e)}`);
      await this.disableHandsFree();
      store.setNotice('person_a', { key: 'generic', kind: 'error' });
      store.setNotice('person_b', { key: 'generic', kind: 'error' });
    }
  }

  async disableHandsFree(): Promise<void> {
    if (!this.enabled) return;
    this.d.log?.info('[hf-server] disabling');
    this.enabled = false;
    this.paused = false;
    this.run += 1; // anything still in flight is now stale

    // UI first, so the toggle snaps back even if native teardown stalls.
    const store = this.d.store.getState();
    store.setMode('ptt');
    store.setHfActiveSpeaker(null);
    store.setHfUnroutedSpeaker(null);
    store.setHfLive(null);
    this.setActivity('idle');

    const turn = this.currentTurnId;
    this.currentTurnId = null;
    if (turn) store.endTurn(turn, { stage: 'done' });

    this.unsubVad?.();
    this.unsubVad = null;
    this.d.vad.setActive(false);
    try {
      await this.d.capture.stopStreaming();
    } catch {
      // already stopped
    }
    this.d.stopSpeaking();
    this.state = 'idle';
    this.pair = null;
    this.resetBuffers();
    resetAudioLevel();
  }

  /** Offline: stop listening but stay "on", so the screen can say it is paused. */
  async pauseHandsFree(): Promise<void> {
    if (!this.enabled || this.paused) return;
    this.d.log?.info('[hf-server] pausing');
    this.paused = true;
    this.run += 1;
    this.state = 'idle';
    this.resetBuffers();
    this.setActivity('idle');
    this.d.store.getState().setHfActiveSpeaker(null);
    this.d.vad.setActive(false);
    this.d.stopSpeaking();
    const turn = this.currentTurnId;
    this.currentTurnId = null;
    if (turn) this.d.store.getState().endTurn(turn, { stage: 'done' });
    try {
      await this.d.capture.stopStreaming();
    } catch {
      // already stopped
    }
    resetAudioLevel();
  }

  async resumeHandsFree(): Promise<void> {
    if (!this.enabled || !this.paused) return;
    this.d.log?.info('[hf-server] resuming');
    try {
      this.d.capture.startStreaming(this.onAudio);
    } catch (e) {
      this.d.log?.warn(`[hf-server] resume failed: ${String(e)}`);
      return; // stays paused so the reader can switch it off
    }
    this.paused = false;
    this.d.vad.resetState();
    this.d.vad.setActive(true);
  }

  /** Tap on the translation: stop reading it aloud and listen again. */
  skipHfTurn(): void {
    if (!this.enabled || this.state !== 'working') return;
    this.skipRequested = true; // if it is not speaking yet, it will not start
    this.d.stopSpeaking(); // if it is, the pending speak() resolves and the turn finishes itself
  }

  // ── audio in ────────────────────────────────────────────────────────────

  private readonly onAudio = (base64Pcm: string): void => {
    if (!this.enabled || this.paused) return;
    const pcm = decodePcm16(base64Pcm);
    if (pcm.length === 0) return;

    // Only the room may reach the transcriber or the seam wave. While the phone
    // works or speaks, the microphone is hearing itself.
    const fromTheRoom = this.state === 'idle' || this.state === 'capturing';
    if (!fromTheRoom) return;

    if (this.state === 'capturing') {
      this.utterance.push(pcm);
      this.utteranceSamples += pcm.length;
      if (this.utteranceSamples >= MAX_SAMPLES) {
        this.d.log?.warn('[hf-server] utterance hit the length cap — ending it');
        this.d.vad.endUtterance();
        void this.onSpeechEnd();
        return;
      }
    } else {
      this.preroll.push(pcm);
      this.prerollSamples += pcm.length;
      while (this.preroll.length > 1 && this.prerollSamples - this.preroll[0].length >= PREROLL_SAMPLES) {
        this.prerollSamples -= this.preroll[0].length;
        this.preroll.shift();
      }
    }
    this.feedVad(pcm);
  };

  private feedVad(incoming: Int16Array): void {
    const merged = new Int16Array(this.vadBuffer.length + incoming.length);
    merged.set(this.vadBuffer);
    merged.set(incoming, this.vadBuffer.length);
    this.vadBuffer = merged.length > MAX_VAD_BUFFER ? merged.slice(merged.length - MAX_VAD_BUFFER) : merged;
    while (this.vadBuffer.length >= VAD_FRAME) {
      const frame = this.vadBuffer.slice(0, VAD_FRAME);
      publishAudioFrame(frameRms(frame));
      try {
        this.d.vad.feedFrame(frame);
      } catch (e) {
        this.d.log?.warn(`[hf-server] VAD threw: ${String(e)}`);
        this.vadBuffer = new Int16Array(0);
        return;
      }
      this.vadBuffer = this.vadBuffer.slice(VAD_FRAME);
    }
  }

  // ── one utterance ───────────────────────────────────────────────────────

  private onSpeechStart(): void {
    if (!this.enabled || this.paused || this.state !== 'idle') return;
    this.utterance = [...this.preroll];
    this.utteranceSamples = this.prerollSamples;
    this.preroll = [];
    this.prerollSamples = 0;
    this.state = 'capturing';
    this.setActivity('listening');
  }

  private async onSpeechEnd(): Promise<void> {
    if (!this.enabled || this.paused || this.state !== 'capturing' || !this.pair) return;
    const run = ++this.run;
    const pieces = this.utterance;
    const samples = this.utteranceSamples;
    this.utterance = [];
    this.utteranceSamples = 0;
    this.state = 'working';
    this.skipRequested = false;
    this.d.vad.setActive(false);

    if (samples < MIN_SAMPLES || sampleCount(pieces) < MIN_SAMPLES) {
      return this.backToListening(run, false);
    }
    this.setActivity('speaking'); // the seam keeps breathing while the answer is prepared
    const { a, b } = this.pair;
    let turn: string | null = null;
    try {
      const t0 = Date.now();
      const trimmed = trimTrailingSilence(pieces);
      const wav = pcmToWavBase64(trimmed);
      const spec = listenSpec(a, b, this.d.mixedSpeech());
      const heard = await this.d.transcribe(wav, spec.language, { mix: spec.mix });
      const tStt = Date.now();
      if (run !== this.run) return;
      const text = heard.text.trim();
      if (text === '') return this.backToListening(run, false); // noise: stay quiet, listen on

      const store = this.d.store.getState();
      const last = [...store.turns].reverse().find(t => t.stage === 'done');
      let route = routeUtterance(a, b, heard.detected, text, last?.speakerId ?? null);
      this.d.log?.info(`[hf-server] heard (${heard.detected ?? '?'}) → ${route.speakerId} via ${route.kind}`);

      const id = turnId();
      turn = id;
      this.currentTurnId = id;
      store.setHfActiveSpeaker(route.speakerId);
      store.startTurn({
        id,
        speakerId: route.speakerId,
        sourceLang: route.sourceLang,
        targetLang: route.targetLang,
        sourceText: text,
        translatedText: '',
        stage: 'translating',
        startedAt: Date.now(),
      });

      const ask = (r: typeof route): Promise<TranslateResult> =>
        this.d.translate({
          text,
          sourceLang: r.sourceLang,
          targetLang: r.targetLang,
          context: this.contextLines(id),
          sourceMix: this.mixOf(r.sourceLang),
        });
      let out = await ask(route);
      if (run !== this.run) return;

      // A guessed direction that "translated" the sentence into itself was the
      // wrong way round: try the other, and keep whichever really translated.
      if (wasGuessed(route.kind) && returnedItsInput(text, out.text)) {
        const other = {
          speakerId: route.speakerId === 'person_a' ? ('person_b' as const) : ('person_a' as const),
          sourceLang: route.targetLang,
          targetLang: route.sourceLang,
          kind: 'text' as const,
        };
        this.d.log?.warn(`[hf-server] ${route.sourceLang}→${route.targetLang} returned its input — trying the other way`);
        const retry = await ask(other);
        if (run !== this.run) return;
        if (!returnedItsInput(text, retry.text)) {
          route = other;
          out = retry;
          this.d.store.getState().updateTurn(id, {
            speakerId: other.speakerId,
            sourceLang: other.sourceLang,
            targetLang: other.targetLang,
          });
          this.d.store.getState().setHfActiveSpeaker(other.speakerId);
        }
      }

      const tTr = Date.now();
      this.d.log?.info(
        `[hf-server] timing: stt ${tStt - t0} ms · translate ${tTr - tStt} ms · ` +
          `audio ${(sampleCount(trimmed) / WAV_SAMPLE_RATE).toFixed(1)} s sent ` +
          `(${(samples / WAV_SAMPLE_RATE).toFixed(1)} s captured)`,
      );
      this.d.store.getState().updateTurn(id, { translatedText: out.text, stage: 'speaking' });
      const outcome: SpeakResult = this.skipRequested ? 'skipped' : await this.d.speak(out.text, route.targetLang);
      if (run !== this.run) return;
      const s = this.d.store.getState();
      if (outcome === 'no-voice') {
        const listener: PersonId = route.speakerId === 'person_a' ? 'person_b' : 'person_a';
        s.setNotice(listener, { key: 'noVoice', kind: 'info', lang: route.targetLang });
      }
      s.endTurn(id, { stage: 'done' });
      this.currentTurnId = null;
      return this.backToListening(run, true);
    } catch (e) {
      if (run !== this.run) return;
      const message = e instanceof Error ? e.message : String(e);
      this.d.log?.warn(`[hf-server] utterance failed: ${message}`);
      const key: NoticeKey = noticeFor(e);
      const s = this.d.store.getState();
      if (turn) {
        s.setNotice(s.turns.find(t => t.id === turn)?.speakerId ?? 'person_a', { key, kind: 'error' });
        s.endTurn(turn, { stage: 'error', errorMessage: message });
        this.currentTurnId = null;
      } else {
        // The failure came before anyone was identified: both readers hear of it.
        s.setNotice('person_a', { key, kind: 'error' });
        s.setNotice('person_b', { key, kind: 'error' });
      }
      return this.backToListening(run, true);
    }
  }

  /** Back to listening. `cool` waits out the phone's own echo tail first. */
  private async backToListening(run: number, cool: boolean): Promise<void> {
    if (run !== this.run) return;
    this.d.store.getState().setHfActiveSpeaker(null);
    this.setActivity('idle');
    if (cool) {
      this.state = 'cooldown';
      await this.sleep(COOLDOWN_MS);
      if (run !== this.run || !this.enabled) return;
    }
    if (this.paused) return;
    this.resetBuffers();
    this.state = 'idle';
    this.d.vad.resetState();
    this.d.vad.setActive(true);
  }

  // ── helpers ─────────────────────────────────────────────────────────────

  private mixOf(sourceLang: string): readonly string[] | undefined {
    const mix = mixFor(sourceLang, this.d.mixedSpeech());
    return mix.length > 0 ? mix : undefined;
  }

  /** The last few finished turns, as "Language: words" — for the translator only. */
  private contextLines(currentId: string): string[] {
    return this.d.store
      .getState()
      .turns.filter((t: Turn) => t.id !== currentId && t.stage === 'done' && t.sourceText.trim() !== '')
      .slice(-CONTEXT_TURNS)
      .map((t: Turn) => `${getLanguage(t.sourceLang).name}: ${t.sourceText.trim()}`);
  }

  private setActivity(a: 'idle' | 'listening' | 'speaking'): void {
    this.d.store.getState().setHfActivity(a);
  }

  private resetBuffers(): void {
    this.preroll = [];
    this.prerollSamples = 0;
    this.utterance = [];
    this.utteranceSamples = 0;
    this.vadBuffer = new Int16Array(0);
  }

  private sleep(ms: number): Promise<void> {
    return this.d.sleep ? this.d.sleep(ms) : new Promise(r => setTimeout(r, ms));
  }
}
