// wav — 16 kHz · mono · 16-bit PCM pieces → one base64 WAV, for /stt.
//
// Push-to-talk gets its WAV from the recorder. Hands-free has no file: the
// microphone streams chunks and the VAD decides where an utterance starts and
// ends, so the file is built here from the chunks it kept.
//
// Byte order: little-endian, like pcm.ts (every platform this app runs on).

import { encodePcm16 } from './pcm';

export const WAV_SAMPLE_RATE = 16_000;
const HEADER_BYTES = 44;

/** Total samples across the pieces. */
export function sampleCount(pieces: readonly Int16Array[]): number {
  let n = 0;
  for (const p of pieces) n += p.length;
  return n;
}

/**
 * Drops the quiet tail the VAD waited through before declaring the utterance over.
 * That wait is pure silence, yet it would otherwise be uploaded and decoded.
 * Works on the samples themselves (not clocks), so a noisy room simply trims
 * nothing. `keepSamples` of tail stay, so a soft final consonant survives.
 */
export function trimTrailingSilence(
  pieces: readonly Int16Array[],
  opts: { windowSamples?: number; peak?: number; keepSamples?: number } = {},
): Int16Array[] {
  const win = opts.windowSamples ?? 320; // 20 ms
  const peak = opts.peak ?? 500; // ≈ −36 dBFS
  const keep = opts.keepSamples ?? Math.round(WAV_SAMPLE_RATE * 0.2);
  const total = sampleCount(pieces);
  if (total <= win) return [...pieces];

  const all = new Int16Array(total);
  let at = 0;
  for (const p of pieces) {
    all.set(p, at);
    at += p.length;
  }
  // Walk back window by window to the last one that is not quiet.
  let end = total;
  while (end - win >= 0) {
    let loud = false;
    for (let i = end - win; i < end; i++) {
      const s = all[i];
      if (s > peak || s < -peak) {
        loud = true;
        break;
      }
    }
    if (loud) break;
    end -= win;
  }
  const cut = Math.min(total, end + keep);
  return cut >= total ? [...pieces] : [all.subarray(0, cut)];
}

/** Base64 of a complete WAV file holding `pieces` back to back. */
export function pcmToWavBase64(pieces: readonly Int16Array[], sampleRate = WAV_SAMPLE_RATE): string {
  const samples = sampleCount(pieces);
  const dataBytes = samples * 2;
  const buf = new ArrayBuffer(HEADER_BYTES + dataBytes);
  const v = new DataView(buf);
  const tag = (at: number, s: string): void => {
    for (let i = 0; i < s.length; i++) v.setUint8(at + i, s.charCodeAt(i));
  };
  tag(0, 'RIFF');
  v.setUint32(4, 36 + dataBytes, true);
  tag(8, 'WAVE');
  tag(12, 'fmt ');
  v.setUint32(16, 16, true); // fmt chunk size
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true); // byte rate
  v.setUint16(32, 2, true); // block align
  v.setUint16(34, 16, true); // bits per sample
  tag(36, 'data');
  v.setUint32(40, dataBytes, true);

  // The header is 44 bytes = 22 samples, so the audio starts on a sample boundary.
  const body = new Int16Array(buf, HEADER_BYTES, samples);
  let at = 0;
  for (const p of pieces) {
    body.set(p, at);
    at += p.length;
  }
  return encodePcm16(new Int16Array(buf));
}
