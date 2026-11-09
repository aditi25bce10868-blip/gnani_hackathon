import { pcmToWavBase64, sampleCount, trimTrailingSilence } from '../wav';

const bytes = (b64: string): Buffer => Buffer.from(b64, 'base64');

describe('pcmToWavBase64', () => {
  it('writes a valid 16 kHz mono 16-bit header and the samples after it', () => {
    const wav = bytes(pcmToWavBase64([Int16Array.from([1, -2, 3]), Int16Array.from([4])]));
    expect(wav.length).toBe(44 + 8);
    expect(wav.toString('ascii', 0, 4)).toBe('RIFF');
    expect(wav.readUInt32LE(4)).toBe(36 + 8);
    expect(wav.toString('ascii', 8, 16)).toBe('WAVEfmt ');
    expect(wav.readUInt16LE(20)).toBe(1); // PCM
    expect(wav.readUInt16LE(22)).toBe(1); // mono
    expect(wav.readUInt32LE(24)).toBe(16_000);
    expect(wav.readUInt32LE(28)).toBe(32_000);
    expect(wav.readUInt16LE(34)).toBe(16);
    expect(wav.toString('ascii', 36, 40)).toBe('data');
    expect(wav.readUInt32LE(40)).toBe(8);
    expect([0, 1, 2, 3].map(i => wav.readInt16LE(44 + i * 2))).toEqual([1, -2, 3, 4]);
  });

  it('is a header only for no audio', () => {
    expect(bytes(pcmToWavBase64([])).length).toBe(44);
  });

  it('counts samples', () => {
    expect(sampleCount([new Int16Array(3), new Int16Array(5)])).toBe(8);
  });
});

describe('trimTrailingSilence', () => {
  const speech = (n: number) => new Int16Array(n).fill(3000);
  const quiet = (n: number) => new Int16Array(n).fill(20);

  it('cuts a long quiet tail but keeps a short one after the last speech', () => {
    const out = trimTrailingSilence([speech(8000), quiet(6400)]); // 0.5 s speech + 0.4 s quiet
    expect(sampleCount(out)).toBe(8000 + 3200); // keeps 0.2 s of tail
  });

  it('never touches the speech itself', () => {
    const out = trimTrailingSilence([quiet(1600), speech(8000), quiet(9600)]);
    const flat = Int16Array.from(out.flatMap(p => Array.from(p)));
    expect(flat.slice(1600, 9600).every(s => s === 3000)).toBe(true);
  });

  it('trims nothing when the room is noisy (tail is not quiet)', () => {
    const pieces = [speech(8000), speech(6400)];
    expect(sampleCount(trimTrailingSilence(pieces))).toBe(14400);
  });

  it('leaves a short tail alone', () => {
    expect(sampleCount(trimTrailingSilence([speech(8000), quiet(1600)]))).toBe(9600);
  });

  it('handles empty and tiny input', () => {
    expect(sampleCount(trimTrailingSilence([]))).toBe(0);
    expect(sampleCount(trimTrailingSilence([quiet(100)]))).toBe(100);
  });
});
