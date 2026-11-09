import { useConversationStore } from '../../../store/conversationStore';
import { ServerError } from '../serverApi';
import { ServerConverse, noticeFor, type ConverseDeps, type SpeakResult } from '../ServerConverse';
import type { TranslateRequest } from '../types';

// ~1 s of 16 kHz/16-bit audio as base64.
const GOOD_WAV = Buffer.alloc(32_000, 1).toString('base64');
const TINY_WAV = Buffer.alloc(1_000, 1).toString('base64');

const A = { speakerId: 'person_a', sourceLang: 'hi', targetLang: 'en' } as const;

function setup(over: Partial<ConverseDeps> = {}, wav = GOOD_WAV) {
  const capture = {
    hasPermission: jest.fn(async () => true),
    requestPermission: jest.fn(async () => true),
    start: jest.fn(),
    stop: jest.fn(async () => '/tmp/x.wav'),
    isRecording: false,
  };
  capture.start.mockImplementation(() => {
    capture.isRecording = true;
  });
  capture.stop.mockImplementation(async () => {
    capture.isRecording = false;
    return '/tmp/x.wav';
  });
  // The default collaborators, kept as typed mocks so tests can inspect them.
  const deps = {
    transcribe: jest.fn(async (_wav: string, _lang: string, _opts: { mix: readonly string[] }) => 'मैं tomorrow office जा रहा हूँ'),
    translate: jest.fn(async (r: TranslateRequest) => ({ text: `EN(${r.text})` })),
    speak: jest.fn(async (_text: string, _lang: string): Promise<SpeakResult> => 'spoken'),
    stopSpeaking: jest.fn(),
  };
  const all: ConverseDeps = {
    capture,
    readBase64: async () => wav,
    store: useConversationStore,
    mixedSpeech: () => true,
    sleep: async () => {},
    ...deps,
    ...over,
  };
  return { engine: new ServerConverse(all), deps, capture };
}

/** Press, release, and wait for the whole turn. */
async function speakOnce(engine: ServerConverse, args: Parameters<ServerConverse['beginTurn']>[0] = A) {
  const done = engine.beginTurn(args);
  await Promise.resolve();
  await engine.endTurn();
  await done;
}

const state = () => useConversationStore.getState();
const lastTurn = () => state().turns[state().turns.length - 1];

beforeEach(() => {
  useConversationStore.setState({ turns: [], activeTurnId: null, notices: { person_a: null, person_b: null } });
});

describe('a normal turn', () => {
  test('listens, translates, speaks — and the turn ends done with both texts', async () => {
    const { engine, deps } = setup();
    await speakOnce(engine);
    expect(lastTurn()).toMatchObject({
      speakerId: 'person_a',
      sourceText: 'मैं tomorrow office जा रहा हूँ',
      translatedText: 'EN(मैं tomorrow office जा रहा हूँ)',
      stage: 'done',
    });
    expect(state().activeTurnId).toBeNull();
    expect(deps.speak).toHaveBeenCalledWith('EN(मैं tomorrow office जा रहा हूँ)', 'en');
    expect(state().notices).toEqual({ person_a: null, person_b: null });
  });

  test('the stage walks recording → transcribing → translating → speaking', async () => {
    const seen: string[] = [];
    const unsub = useConversationStore.subscribe(s => {
      const t = s.turns[s.turns.length - 1];
      if (t && seen[seen.length - 1] !== t.stage) seen.push(t.stage);
    });
    const { engine } = setup();
    await speakOnce(engine);
    unsub();
    expect(seen).toEqual(['recording', 'transcribing', 'translating', 'speaking', 'done']);
  });

  test('the translation is on screen before the voice has finished', async () => {
    let seenWhileSpeaking = '';
    const { engine } = setup({
      speak: jest.fn(async () => {
        seenWhileSpeaking = lastTurn().translatedText;
        return 'spoken' as const;
      }),
    });
    await speakOnce(engine);
    expect(seenWhileSpeaking).toBe('EN(मैं tomorrow office जा रहा हूँ)');
  });
});

describe('mixed speech', () => {
  test('Hindi with the switch on is heard together with English, and the translator is told', async () => {
    const { engine, deps } = setup();
    await speakOnce(engine);
    expect(deps.transcribe).toHaveBeenCalledWith(GOOD_WAV, 'hi', { mix: ['en'] });
    expect(deps.translate.mock.calls[0][0]).toMatchObject({ sourceLang: 'hi', targetLang: 'en', sourceMix: ['en'] });
  });

  test('switch off → plain single-language listening, no hint to the translator', async () => {
    const { engine, deps } = setup({ mixedSpeech: () => false });
    await speakOnce(engine);
    expect(deps.transcribe).toHaveBeenCalledWith(GOOD_WAV, 'hi', { mix: [] });
    expect(deps.translate.mock.calls[0][0].sourceMix).toBeUndefined();
  });

  test.each(['en', 'hi-hinglish', 'es'])('%s never gets a mix hint', async lang => {
    const { engine, deps } = setup();
    await speakOnce(engine, { speakerId: 'person_a', sourceLang: lang, targetLang: 'hi' });
    expect(deps.transcribe).toHaveBeenCalledWith(GOOD_WAV, lang, { mix: [] });
  });

  test('the switch is read at every turn', async () => {
    let on = true;
    const { engine, deps } = setup({ mixedSpeech: () => on });
    await speakOnce(engine);
    on = false;
    await speakOnce(engine);
    expect(deps.transcribe.mock.calls.map(c => c[2].mix)).toEqual([['en'], []]);
  });
});

describe('conversation context', () => {
  test('the translator gets the last three finished turns, oldest first, current one excluded', async () => {
    const { engine, deps } = setup();
    deps.transcribe
      .mockResolvedValueOnce('one')
      .mockResolvedValueOnce('two')
      .mockResolvedValueOnce('three')
      .mockResolvedValueOnce('four')
      .mockResolvedValueOnce('five');
    for (let i = 0; i < 5; i++) await speakOnce(engine);
    expect(deps.translate.mock.calls[0][0].context).toEqual([]);
    expect(deps.translate.mock.calls[4][0].context).toEqual(['Hindi: two', 'Hindi: three', 'Hindi: four']);
  });
});

describe('when nothing usable was heard', () => {
  test('a mis-tap (under 0.25 s) is not sent anywhere', async () => {
    const { engine, deps } = setup({}, TINY_WAV);
    await speakOnce(engine);
    expect(deps.transcribe).not.toHaveBeenCalled();
    expect(lastTurn().stage).toBe('done');
    expect(state().notices.person_a).toEqual({ key: 'didntCatch', kind: 'info' });
  });

  test('an empty transcript ends quietly with "didn\'t catch that"', async () => {
    const { engine, deps } = setup({ transcribe: jest.fn(async () => '   ') });
    await speakOnce(engine);
    expect(deps.translate).not.toHaveBeenCalled();
    expect(lastTurn().stage).toBe('done');
    expect(state().notices.person_a?.key).toBe('didntCatch');
  });

  test('a recording the server would refuse is stopped before it is sent', async () => {
    const huge = Buffer.alloc(1_000_000, 1).toString('base64');
    const { engine, deps } = setup({}, huge);
    await speakOnce(engine);
    expect(deps.transcribe).not.toHaveBeenCalled();
    expect(lastTurn().stage).toBe('error');
  });
});

describe('failures land on the speaker, as a notice key', () => {
  test.each([
    [new ServerError('x', 'network'), 'connectionDropped'],
    [new ServerError('x', 'timeout'), 'connectionDropped'],
    [new ServerError('x', 'rate_limited'), 'rateLimit'],
    [new ServerError('x', 'credits'), 'generic'],
    [new ServerError('x', 'auth'), 'generic'],
    [new Error('boom'), 'generic'],
  ])('%s → %s', (err, key) => {
    expect(noticeFor(err)).toBe(key);
  });

  test('a speech-recognition failure ends the turn in error and frees the discs', async () => {
    const { engine } = setup({
      transcribe: jest.fn(async () => {
        throw new ServerError('down', 'network');
      }),
    });
    await speakOnce(engine);
    expect(lastTurn()).toMatchObject({ stage: 'error' });
    expect(state().activeTurnId).toBeNull();
    expect(state().notices.person_a).toEqual({ key: 'connectionDropped', kind: 'error' });
    // …and the next press works.
    const again = setup();
    await speakOnce(again.engine);
    expect(lastTurn().stage).toBe('done');
  });

  test('a translation failure keeps what was heard', async () => {
    const { engine } = setup({
      translate: jest.fn(async () => {
        throw new ServerError('slow', 'rate_limited');
      }),
    });
    await speakOnce(engine);
    expect(lastTurn()).toMatchObject({ stage: 'error', sourceText: 'मैं tomorrow office जा रहा हूँ' });
    expect(state().notices.person_a?.key).toBe('rateLimit');
  });

  test('no voice for the target tells the LISTENER, not the speaker', async () => {
    const { engine } = setup({ speak: jest.fn(async () => 'no-voice' as const) });
    await speakOnce(engine);
    expect(lastTurn().stage).toBe('done');
    expect(state().notices.person_b).toEqual({ key: 'noVoice', kind: 'info', lang: 'en' });
    expect(state().notices.person_a).toBeNull();
  });
});

describe('microphone and lifecycle', () => {
  test('denied permission: a notice, no turn, nothing recorded', async () => {
    const { engine, capture } = setup();
    capture.hasPermission.mockResolvedValue(false);
    capture.requestPermission.mockResolvedValue(false);
    await engine.beginTurn(A);
    expect(state().turns).toHaveLength(0);
    expect(capture.start).not.toHaveBeenCalled();
    expect(state().notices.person_a?.key).toBe('micPermission');
  });

  test('a press that ended under the permission dialog does not record', async () => {
    const { engine, capture } = setup();
    capture.hasPermission.mockResolvedValue(false);
    capture.requestPermission.mockResolvedValue(true);
    await engine.beginTurn(A);
    expect(capture.start).not.toHaveBeenCalled();
    expect(state().turns).toHaveLength(0);
  });

  test('a second press while a turn is running is ignored', async () => {
    const { engine, capture } = setup();
    const done = engine.beginTurn(A);
    await Promise.resolve();
    await engine.beginTurn({ ...A, speakerId: 'person_b' });
    expect(capture.start).toHaveBeenCalledTimes(1);
    await engine.endTurn();
    await done;
    expect(state().turns).toHaveLength(1);
  });

  test('cancel while the server is still listening: turn ends done, nothing is translated or spoken', async () => {
    let release!: (t: string) => void;
    const { engine, deps } = setup({
      transcribe: jest.fn((_w: string, _l: string, _o: { mix: readonly string[] }) => new Promise<string>(r => (release = r))),
    });
    const done = engine.beginTurn(A);
    await Promise.resolve();
    const ending = engine.endTurn();
    await new Promise(r => setImmediate(r));
    await engine.cancelTurn();
    await done;
    expect(lastTurn().stage).toBe('done');
    expect(state().activeTurnId).toBeNull();
    expect(deps.stopSpeaking).toHaveBeenCalled();

    release('late answer');
    await ending;
    expect(deps.translate).not.toHaveBeenCalled();
    expect(deps.speak).not.toHaveBeenCalled();
    expect(lastTurn().sourceText).toBe('');
  });

  test('a stale turn cannot disturb the next one', async () => {
    let release!: (t: string) => void;
    const slow = jest.fn((_w: string, _l: string, _o: { mix: readonly string[] }) => new Promise<string>(r => (release = r)));
    const { engine } = setup({ transcribe: slow });
    const first = engine.beginTurn(A);
    await Promise.resolve();
    const ending = engine.endTurn();
    await new Promise(r => setImmediate(r));
    await engine.cancelTurn();
    await first;

    slow.mockResolvedValueOnce('fresh');
    await speakOnce(engine);
    release('stale');
    await ending;
    expect(state().turns).toHaveLength(2);
    expect(lastTurn()).toMatchObject({ sourceText: 'fresh', stage: 'done' });
    expect(state().activeTurnId).toBeNull();
  });

  test('cancel while recording stops the microphone', async () => {
    const { engine, capture } = setup();
    const done = engine.beginTurn(A);
    await Promise.resolve();
    await engine.cancelTurn();
    await done;
    expect(capture.stop).toHaveBeenCalled();
    expect(lastTurn().stage).toBe('done');
  });

  test('cancel with nothing running is a no-op', async () => {
    const { engine, deps } = setup();
    await engine.cancelTurn();
    expect(deps.stopSpeaking).not.toHaveBeenCalled();
  });

  test('a hold longer than the server accepts is ended for the speaker', async () => {
    jest.useFakeTimers();
    try {
      const { engine, deps } = setup();
      const done = engine.beginTurn(A);
      await Promise.resolve();
      await jest.advanceTimersByTimeAsync(28_500);
      await done;
      expect(deps.transcribe).toHaveBeenCalledTimes(1);
      expect(lastTurn().stage).toBe('done');
    } finally {
      jest.useRealTimers();
    }
  });
});
