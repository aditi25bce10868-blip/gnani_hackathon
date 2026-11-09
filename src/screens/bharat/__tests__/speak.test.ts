const mockSynth = jest.fn();
const mockPlay = jest.fn();
const mockStopWav = jest.fn();
const mockSpeakChunk = jest.fn();
const mockStopTts = jest.fn();

jest.mock('../../../services/bharat/config', () => ({
  BHARAT_API: { baseUrl: 'https://api.test', appToken: 't', serverTts: true },
}));
jest.mock('../../../services/bharat/serverVoice', () => ({
  SERVER_TTS_LANGS: new Set(['hi', 'ta', 'en']),
  synthesize: (...a: unknown[]) => mockSynth(...a),
}));
jest.mock('../../../services/native/bharatSystem', () => ({
  playWav: (...a: unknown[]) => mockPlay(...a),
  stopWav: () => mockStopWav(),
}));
jest.mock('../../../services/tts/NativeTTSService', () => ({
  nativeTTSService: { speakChunk: (...a: unknown[]) => mockSpeakChunk(...a), stop: () => mockStopTts() },
}));
jest.mock('../../../services/log/logStore', () => ({ log: { warn: jest.fn(), info: jest.fn() } }));

import { speakText, stopSpeaking } from '../speak';

beforeEach(() => {
  jest.clearAllMocks();
  mockSynth.mockResolvedValue('WAV');
  mockPlay.mockResolvedValue(undefined);
  mockSpeakChunk.mockResolvedValue('spoken');
});

test('a Gnani language is synthesised on the server and played', async () => {
  expect(await speakText('नमस्ते', 'hi')).toBe('spoken');
  expect(mockSynth).toHaveBeenCalledWith(expect.anything(), 'नमस्ते', 'hi');
  expect(mockPlay).toHaveBeenCalledWith('WAV');
  expect(mockSpeakChunk).not.toHaveBeenCalled();
});

test('a language Gnani lacks uses the phone voice and spends no credits', async () => {
  await speakText('ନମସ୍କାର', 'or');
  expect(mockSynth).not.toHaveBeenCalled();
  expect(mockSpeakChunk).toHaveBeenCalledWith('ନମସ୍କାର', 'or');
});

test('server failure (no credits, offline) falls back to the phone voice', async () => {
  mockSynth.mockRejectedValue(new Error('Speech credits are used up for now.'));
  expect(await speakText('hello', 'en')).toBe('spoken');
  expect(mockSpeakChunk).toHaveBeenCalledWith('hello', 'en');
});

test('a playback failure also falls back', async () => {
  mockPlay.mockRejectedValue(new Error('No audio player in this build.'));
  await speakText('hello', 'en');
  expect(mockSpeakChunk).toHaveBeenCalled();
});

test('stopping while audio is still downloading means it never plays', async () => {
  let release: (v: string) => void = () => {};
  mockSynth.mockReturnValue(new Promise<string>(r => { release = r; }));
  const pending = speakText('hello', 'en');
  stopSpeaking();
  release('WAV');
  await pending;
  expect(mockPlay).not.toHaveBeenCalled();
  expect(mockSpeakChunk).not.toHaveBeenCalled();
  expect(mockStopWav).toHaveBeenCalled();
});

test('a newer request replaces an older one still downloading', async () => {
  let releaseFirst: (v: string) => void = () => {};
  mockSynth.mockReturnValueOnce(new Promise<string>(r => { releaseFirst = r; }));
  const first = speakText('one', 'en');
  const second = speakText('two', 'en');
  releaseFirst('OLD');
  await Promise.all([first, second]);
  expect(mockPlay).toHaveBeenCalledTimes(1);
  expect(mockPlay).toHaveBeenCalledWith('WAV');
});
