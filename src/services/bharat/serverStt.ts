// Tap-to-speak listening: records a WAV on the phone, the server turns it into
// text (Gnani, or free Whisper for languages Gnani lacks).

import * as RNFS from '@dr.pogodin/react-native-fs';
import { audioCaptureService } from '../audio/AudioCaptureService';
import { ServerError, type ServerConfig } from './serverApi';
import { transcribe } from './serverVoice';
import type { SttProvider, SttResult } from './types';

// 16 kHz · mono · 16-bit = 32 000 bytes per second.
const MIN_BYTES = 8_000; // < 0.25 s is a mis-tap, not speech
const MAX_BYTES = 990_000; // ≈ 30 s, Gnani's limit

interface Capture {
  hasPermission(): Promise<boolean>;
  requestPermission(): Promise<boolean>;
  start(): void;
  stop(): Promise<string>;
  readonly isRecording: boolean;
}

export interface SttDeps {
  readonly capture: Capture;
  readonly readBase64: (path: string) => Promise<string>;
  readonly fetchImpl?: typeof fetch;
}

const defaultDeps: SttDeps = {
  capture: audioCaptureService,
  readBase64: path => RNFS.readFile(path, 'base64'),
};

export class ServerSttProvider implements SttProvider {
  readonly name = 'Gnani · BharatConnect server';
  readonly isMock = false;
  private lang = 'hi';

  constructor(
    private readonly cfg: ServerConfig,
    private readonly deps: SttDeps = defaultDeps,
  ) {}

  async start(lang: string): Promise<void> {
    this.lang = lang;
    const { capture } = this.deps;
    if (!(await capture.hasPermission()) && !(await capture.requestPermission())) {
      throw new ServerError('Microphone permission is needed to listen.');
    }
    capture.start();
  }

  async stop(): Promise<SttResult> {
    const path = await this.deps.capture.stop();
    const b64 = await this.deps.readBase64(path);
    const bytes = Math.floor((b64.length * 3) / 4);
    if (bytes < MIN_BYTES) return { text: '', lang: this.lang };
    if (bytes > MAX_BYTES) throw new ServerError('That was longer than 30 seconds. Try a shorter sentence.');
    const text = await transcribe(this.cfg, b64, this.lang, this.deps.fetchImpl);
    return { text, lang: this.lang };
  }

  cancel(): void {
    if (this.deps.capture.isRecording) void this.deps.capture.stop().catch(() => {});
  }
}
