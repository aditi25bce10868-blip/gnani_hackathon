import { detectLanguage } from '../scriptDetect';
import { ocrScriptsFor } from '../ocrScript';
import { MockSttProvider, MockTranslateProvider } from '../mockProviders';
import { AUTO_LANG } from '../types';
import { useBharatStore } from '../../../store/bharatStore';

describe('detectLanguage', () => {
  test.each([
    ['यह कितने का है?', 'hi'],
    ['இது எவ்வளவு?', 'ta'],
    ['ఇది ఎంత?', 'te'],
    ['ಇದರ ಬೆಲೆ ಎಷ್ಟು?', 'kn'],
    ['ഇതിന് എത്രയാണ് വില?', 'ml'],
    ['এটার দাম কত?', 'bn'],
    ['How much is this?', 'en'],
  ])('%s → %s', (text, code) => {
    expect(detectLanguage(text)).toBe(code);
  });

  test('empty / symbols only → no guess', () => {
    expect(detectLanguage('')).toBe('');
    expect(detectLanguage('123 ??')).toBe('');
  });
});

describe('MockTranslateProvider', () => {
  const p = new MockTranslateProvider();

  test('phrasebook hit, Hinglish in → Tamil out', async () => {
    const r = await p.translate({ text: 'Yeh kitne ka hai?', sourceLang: 'hi', targetLang: 'ta' });
    expect(r.text).toBe('இது எவ்வளவு?');
  });

  test('auto-detect reports the detected language', async () => {
    const r = await p.translate({ text: 'धन्यवाद', sourceLang: AUTO_LANG, targetLang: 'en' });
    expect(r.text).toBe('Thank you');
    expect(r.detectedLang).toBe('hi');
  });

  test('unknown text is visibly tagged as demo output', async () => {
    const r = await p.translate({ text: 'something else', sourceLang: 'en', targetLang: 'ta' });
    expect(r.text).toContain('demo');
  });
});

describe('MockTranslateProvider.translateMany', () => {
  test('keeps order and length', async () => {
    const out = await new MockTranslateProvider().translateMany(['Thank you', 'x'], 'en', 'hi');
    expect(out).toHaveLength(2);
    expect(out[0]).toBe('धन्यवाद');
  });
});

describe('MockSttProvider', () => {
  test('returns a phrase in the requested language', async () => {
    const stt = new MockSttProvider();
    await stt.start('ta');
    const r = await stt.stop();
    expect(r.lang).toBe('ta');
    expect(r.text).not.toBe('');
  });
});

describe('bharatStore', () => {
  beforeEach(() => useBharatStore.setState({ recents: [] }));

  test('swap exchanges the pair', () => {
    useBharatStore.getState().setSource('voice', 'hi');
    useBharatStore.getState().setTarget('voice', 'ta');
    useBharatStore.getState().swap('voice');
    expect(useBharatStore.getState().pairs.voice).toEqual({ source: 'ta', target: 'hi' });
  });

  test('swap from auto uses the detected language, and is a no-op without one', () => {
    useBharatStore.getState().setSource('translate', AUTO_LANG);
    useBharatStore.getState().setTarget('translate', 'en');
    useBharatStore.getState().swap('translate');
    expect(useBharatStore.getState().pairs.translate).toEqual({ source: AUTO_LANG, target: 'en' });
    useBharatStore.getState().swap('translate', 'hi');
    expect(useBharatStore.getState().pairs.translate).toEqual({ source: 'en', target: 'hi' });
  });

  test('recents de-duplicate and cap at 20', () => {
    const add = useBharatStore.getState().addRecent;
    for (let i = 0; i < 25; i += 1) {
      add({ sourceText: `t${i}`, translatedText: 'x', sourceLang: 'en', targetLang: 'hi' });
    }
    add({ sourceText: 't24', translatedText: 'y', sourceLang: 'en', targetLang: 'hi' });
    const r = useBharatStore.getState().recents;
    expect(r).toHaveLength(20);
    expect(r[0].translatedText).toBe('y');
    expect(r.filter(x => x.sourceText === 't24')).toHaveLength(1);
  });
});

describe('ocrScriptsFor', () => {
  test('on-device scripts', () => {
    expect(ocrScriptsFor('en')).toEqual(['latin']);
    expect(ocrScriptsFor('hi')).toEqual(['devanagari']);
    expect(ocrScriptsFor('mr')).toEqual(['devanagari']);
    expect(ocrScriptsFor('ja')).toEqual(['japanese']);
    expect(ocrScriptsFor(AUTO_LANG)).toEqual(['latin', 'devanagari']);
  });

  test('scripts ML Kit cannot read return none, so the UI can say so', () => {
    for (const l of ['ta', 'te', 'kn', 'ml', 'bn', 'gu', 'pa', 'or', 'as', 'ur']) {
      expect(ocrScriptsFor(l)).toEqual([]);
    }
  });
});

describe('camera pair', () => {
  test('defaults to auto-detect → English', () => {
    expect(useBharatStore.getState().pairs.camera).toEqual({ source: AUTO_LANG, target: 'en' });
  });
});
