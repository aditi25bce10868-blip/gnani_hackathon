import { encodePcm16 } from '../../audio/pcm';
import { useConversationStore } from '../../../store/conversationStore';
import { ServerError } from '../serverApi';
import { ServerHandsFree, type HandsFreeDeps, type Heard } from '../ServerHandsFree';
import type { SpeakResult } from '../ServerConverse';
import type { TranslateRequest } from '../types';

const CHUNK = 1024; // samples per microphone chunk (64 ms)
const chunk = (v = 1000): string => encodePcm16(new Int16Array(CHUNK).fill(v));
const state = () => useConversationStore.getState();
const lastTurn = () => state().turns[state().turns.length - 1];

function setup(over: Partial<HandsFreeDeps> = {}) {
  let onAudio: ((b64: string) => void) | null = null;
  let vadStart: () => void = () => {};
  let vadEnd: (t: number) => void = () => {};
  const capture = {
    hasPermission: jest.fn(async () => true),
    requestPermission: jest.fn(async () => true),
    startStreaming: jest.fn((cb: (b64: string) => void) => {
      onAudio = cb;
    }),
    stopStreaming: jest.fn(async () => {
      onAudio = null;
    }),
  };
  const vad = {
    initialize: jest.fn(async () => {}),
    feedFrame: jest.fn(),
    subscribe: jest.fn((s: () => void, e: (t: number) => void) => {
      vadStart = s;
      vadEnd = e;
      return () => {};
    }),
    setActive: jest.fn(),
    resetState: jest.fn(),
    endUtterance: jest.fn(),
  };
  const deps = {
    transcribe: jest.fn(async (_w: string, _l: string, _o: { mix: readonly string[] }): Promise<Heard> => ({
      text: 'मुझे पानी चाहिए',
      detected: 'hi-IN',
    })),
    translate: jest.fn(async (r: TranslateRequest) => ({ text: `EN(${r.text})` })),
    speak: jest.fn(async (_t: string, _l: string): Promise<SpeakResult> => 'spoken'),
    stopSpeaking: jest.fn(),
  };
  const all: HandsFreeDeps = {
    capture,
    vad,
    store: useConversationStore,
    mixedSpeech: () => true,
    sleep: async () => {},
    ...deps,
    ...over,
  };
  const engine = new ServerHandsFree(all);
  return {
    engine,
    deps,
    capture,
    vad,
    mic: (b64 = chunk()) => onAudio?.(b64),
    hear: () => vadStart(),
    stop: () => vadEnd(Date.now()),
  };
}

/** Quiet before, a sentence, then the VAD calls it over. Waits for the whole turn. */
async function sayOnce(h: ReturnType<typeof setup>, chunks = 12): Promise<void> {
  h.mic(); // pre-roll
  h.mic();
  h.hear();
  for (let i = 0; i < chunks; i++) h.mic();
  h.stop();
  await flush();
}
const flush = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};

beforeEach(() => {
  useConversationStore.setState({
    turns: [],
    activeTurnId: null,
    mode: 'ptt',
    hfActivity: 'idle',
    hfActiveSpeaker: null,
    notices: { person_a: null, person_b: null },
  });
});

describe('enableHandsFree', () => {
  it('warms the connection once on enable, and a throwing warm-up does not stop it', async () => {
    const warmUp = jest.fn(() => {
      throw new Error('offline');
    });
    const h = setup({ warmUp });
    await h.engine.enableHandsFree('hi', 'en');
    expect(warmUp).toHaveBeenCalledTimes(1);
    expect(h.engine.isHandsFreeActive()).toBe(true);
  });

  it('starts the microphone and the VAD and switches the UI to hands-free', async () => {
    const h = setup();
    await h.engine.enableHandsFree('hi', 'en');
    expect(h.engine.isHandsFreeActive()).toBe(true);
    expect(h.capture.startStreaming).toHaveBeenCalledTimes(1);
    expect(h.vad.setActive).toHaveBeenLastCalledWith(true);
    expect(state().mode).toBe('hf');
  });

  it('tells both readers when the microphone is not allowed, and stays off', async () => {
    const h = setup();
    h.capture.hasPermission.mockResolvedValue(false);
    h.capture.requestPermission.mockResolvedValue(false);
    await h.engine.enableHandsFree('hi', 'en');
    expect(h.engine.isHandsFreeActive()).toBe(false);
    expect(h.capture.startStreaming).not.toHaveBeenCalled();
    expect(state().notices.person_a?.key).toBe('micPermission');
    expect(state().notices.person_b?.key).toBe('micPermission');
    expect(state().mode).toBe('ptt');
  });

  it('leaves nothing half-on when the VAD cannot load', async () => {
    const h = setup();
    h.vad.initialize.mockRejectedValue(new Error('onnx'));
    await h.engine.enableHandsFree('hi', 'en');
    expect(h.engine.isHandsFreeActive()).toBe(false);
    expect(state().mode).toBe('ptt');
    expect(state().notices.person_a?.kind).toBe('error');
  });
});

describe('one utterance', () => {
  it('listens for both languages, routes by what was heard, translates and speaks', async () => {
    const h = setup();
    await h.engine.enableHandsFree('hi', 'en');
    await sayOnce(h);

    const [wav, lang, opts] = h.deps.transcribe.mock.calls[0];
    expect(lang).toBe('hi');
    expect(opts.mix).toEqual(['en']);
    expect(Buffer.from(wav, 'base64').toString('ascii', 0, 4)).toBe('RIFF');
    // pre-roll (2 chunks) + 12 spoken chunks, 2 bytes per sample, plus the header
    expect(Buffer.from(wav, 'base64').length).toBe(44 + 14 * CHUNK * 2);

    expect(h.deps.translate.mock.calls[0][0]).toMatchObject({ sourceLang: 'hi', targetLang: 'en', sourceMix: ['en'] });
    expect(h.deps.speak).toHaveBeenCalledWith('EN(मुझे पानी चाहिए)', 'en');
    expect(lastTurn()).toMatchObject({ speakerId: 'person_a', stage: 'done', translatedText: 'EN(मुझे पानी चाहिए)' });
    expect(state().hfActiveSpeaker).toBeNull();
    expect(state().hfActivity).toBe('idle');
  });

  it('routes the other way when Gnani heard the other language', async () => {
    const h = setup();
    h.deps.transcribe.mockResolvedValue({ text: 'Where is the station', detected: 'en-IN' });
    await h.engine.enableHandsFree('hi', 'en');
    await sayOnce(h);
    expect(lastTurn()).toMatchObject({ speakerId: 'person_b', sourceLang: 'en', targetLang: 'hi' });
    expect(h.deps.speak).toHaveBeenCalledWith(expect.any(String), 'hi');
  });

  it('adds English to what it listens for when the pair has none and mixed speech is on', async () => {
    const h = setup();
    await h.engine.enableHandsFree('hi', 'ta');
    await sayOnce(h);
    expect(h.deps.transcribe.mock.calls[0][2].mix).toEqual(['ta', 'en']);
  });

  it('hands the translator the last finished turns as context', async () => {
    const h = setup();
    await h.engine.enableHandsFree('hi', 'en');
    await sayOnce(h);
    await sayOnce(h);
    expect(h.deps.translate.mock.calls[1][0].context).toEqual(['Hindi: मुझे पानी चाहिए']);
  });

  it('ignores the microphone while the phone is speaking, then listens again', async () => {
    let finishSpeaking: () => void = () => {};
    const h = setup({
      speak: jest.fn(
        () =>
          new Promise<SpeakResult>(r => {
            finishSpeaking = () => r('spoken');
          }),
      ),
    });
    await h.engine.enableHandsFree('hi', 'en');
    await sayOnce(h);
    expect(lastTurn().stage).toBe('speaking');

    const frames = h.vad.feedFrame.mock.calls.length;
    h.mic();
    h.mic();
    expect(h.vad.feedFrame.mock.calls.length).toBe(frames); // the room did not hear the phone

    finishSpeaking();
    await flush();
    expect(lastTurn().stage).toBe('done');
    expect(h.vad.setActive).toHaveBeenLastCalledWith(true);
    h.mic();
    expect(h.vad.feedFrame.mock.calls.length).toBeGreaterThan(frames);
  });

  it('stays quiet about a click or a cough', async () => {
    const h = setup();
    await h.engine.enableHandsFree('hi', 'en');
    h.hear();
    h.mic(); // 64 ms
    h.stop();
    await flush();
    expect(h.deps.transcribe).not.toHaveBeenCalled();
    expect(state().turns).toHaveLength(0);
    expect(state().notices.person_a).toBeNull();
    // and it is listening again
    h.deps.transcribe.mockClear();
    await sayOnce(h);
    expect(h.deps.transcribe).toHaveBeenCalledTimes(1);
  });

  it('stays quiet and listens on when nothing intelligible was heard', async () => {
    const h = setup();
    h.deps.transcribe.mockResolvedValue({ text: '  ' });
    await h.engine.enableHandsFree('hi', 'en');
    await sayOnce(h);
    expect(state().turns).toHaveLength(0);
    expect(state().notices.person_a).toBeNull();
    expect(h.vad.setActive).toHaveBeenLastCalledWith(true);
  });

  it('flips the direction when a guessed one translated the sentence into itself', async () => {
    const h = setup();
    // Hindi ↔ Marathi share a script: nothing in the text or audio says who spoke.
    h.deps.transcribe.mockResolvedValue({ text: '12345' });
    h.deps.translate.mockImplementation(async (r: TranslateRequest) =>
      r.sourceLang === 'hi' ? { text: '12345' } : { text: 'बारा हजार' },
    );
    await h.engine.enableHandsFree('hi', 'mr');
    await sayOnce(h);
    expect(h.deps.translate).toHaveBeenCalledTimes(2);
    expect(lastTurn()).toMatchObject({ speakerId: 'person_b', sourceLang: 'mr', targetLang: 'hi', translatedText: 'बारा हजार' });
    expect(h.deps.speak).toHaveBeenCalledWith('बारा हजार', 'hi');
  });

  it('keeps the original when a word survives translation both ways', async () => {
    const h = setup();
    h.deps.transcribe.mockResolvedValue({ text: '2024' });
    h.deps.translate.mockImplementation(async (r: TranslateRequest) => ({ text: r.text }));
    await h.engine.enableHandsFree('hi', 'mr');
    await sayOnce(h);
    expect(lastTurn()).toMatchObject({ speakerId: 'person_a', stage: 'done' });
  });

  it('tells the listener when their language has no voice', async () => {
    const h = setup();
    h.deps.speak.mockResolvedValue('no-voice');
    await h.engine.enableHandsFree('hi', 'en');
    await sayOnce(h);
    expect(state().notices.person_b).toMatchObject({ key: 'noVoice', lang: 'en' });
  });
});

describe('failures', () => {
  it('tells BOTH readers when listening fails (nobody is identified yet), then listens again', async () => {
    const h = setup();
    h.deps.transcribe.mockRejectedValueOnce(new ServerError('down', 'network'));
    await h.engine.enableHandsFree('hi', 'en');
    await sayOnce(h);
    expect(state().notices.person_a).toMatchObject({ key: 'connectionDropped', kind: 'error' });
    expect(state().notices.person_b).toMatchObject({ key: 'connectionDropped', kind: 'error' });
    expect(h.vad.setActive).toHaveBeenLastCalledWith(true);
  });

  it("puts a translation failure on the speaker's own half and ends the turn", async () => {
    const h = setup();
    h.deps.translate.mockRejectedValueOnce(new ServerError('slow', 'rate_limited'));
    await h.engine.enableHandsFree('hi', 'en');
    await sayOnce(h);
    expect(lastTurn().stage).toBe('error');
    expect(state().notices.person_a).toMatchObject({ key: 'rateLimit', kind: 'error' });
    expect(state().notices.person_b).toBeNull();
    expect(h.deps.speak).not.toHaveBeenCalled();
  });
});

describe('skip, pause, disable', () => {
  it('skipping before the voice starts means it never starts', async () => {
    let release: (v: { text: string }) => void = () => {};
    const h = setup({
      translate: jest.fn(() => new Promise(r => { release = r; })),
    });
    await h.engine.enableHandsFree('hi', 'en');
    await sayOnce(h);
    h.engine.skipHfTurn();
    release({ text: 'hello' });
    await flush();
    expect(h.deps.speak).not.toHaveBeenCalled();
    expect(h.deps.stopSpeaking).toHaveBeenCalled();
    expect(lastTurn()).toMatchObject({ stage: 'done', translatedText: 'hello' });
  });

  it('disabling mid-turn ends it quietly and drops the late answer', async () => {
    let release: (v: Heard) => void = () => {};
    const h = setup({ transcribe: jest.fn(() => new Promise<Heard>(r => { release = r; })) });
    await h.engine.enableHandsFree('hi', 'en');
    await sayOnce(h);
    await h.engine.disableHandsFree();
    release({ text: 'नमस्ते', detected: 'hi-IN' });
    await flush();
    expect(h.engine.isHandsFreeActive()).toBe(false);
    expect(state().mode).toBe('ptt');
    expect(h.deps.translate).not.toHaveBeenCalled();
    expect(h.capture.stopStreaming).toHaveBeenCalled();
    expect(h.deps.stopSpeaking).toHaveBeenCalled();
  });

  it('pauses (offline) and resumes without losing its place', async () => {
    const h = setup();
    await h.engine.enableHandsFree('hi', 'en');
    await h.engine.pauseHandsFree();
    expect(h.engine.isHandsFreeActive()).toBe(true);
    expect(h.engine.isHandsFreePaused()).toBe(true);
    expect(state().mode).toBe('hf');
    h.mic(); // nothing is listening
    expect(h.vad.feedFrame).not.toHaveBeenCalled();

    await h.engine.resumeHandsFree();
    expect(h.engine.isHandsFreePaused()).toBe(false);
    expect(h.capture.startStreaming).toHaveBeenCalledTimes(2);
    await sayOnce(h);
    expect(lastTurn().stage).toBe('done');
  });
});
