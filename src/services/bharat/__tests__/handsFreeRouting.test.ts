import { listenSpec, pairOnServer, primarySubtag, returnedItsInput, routeUtterance, wasGuessed } from '../handsFreeRouting';

describe('pairOnServer', () => {
  it('needs both languages on Gnani', () => {
    expect(pairOnServer('hi', 'en')).toBe(true);
    expect(pairOnServer('ta', 'te')).toBe(true);
    expect(pairOnServer('hi', 'es')).toBe(false);
    expect(pairOnServer('ur', 'hi')).toBe(false);
  });
  it('leaves Hinglish and empty or identical pairs out', () => {
    expect(pairOnServer('hi-hinglish', 'en')).toBe(false);
    expect(pairOnServer('en', 'hi-hinglish')).toBe(false);
    expect(pairOnServer('', 'en')).toBe(false);
    expect(pairOnServer('hi', 'hi')).toBe(false);
  });
});

describe('listenSpec', () => {
  it("listens for the other person's language as a hint", () => {
    expect(listenSpec('hi', 'en', false)).toEqual({ language: 'hi', mix: ['en'] });
  });
  it('adds English only when mixed speech is on and English is not already in the pair', () => {
    expect(listenSpec('hi', 'ta', true)).toEqual({ language: 'hi', mix: ['ta', 'en'] });
    expect(listenSpec('hi', 'ta', false)).toEqual({ language: 'hi', mix: ['ta'] });
    expect(listenSpec('hi', 'en', true)).toEqual({ language: 'hi', mix: ['en'] });
  });
});

describe('routeUtterance (A = Hindi, B = English)', () => {
  it('follows strong text evidence', () => {
    const r = routeUtterance('hi', 'en', undefined, 'मुझे पानी चाहिए', null);
    expect(r).toMatchObject({ speakerId: 'person_a', sourceLang: 'hi', targetLang: 'en', kind: 'text' });
  });
  it('lets strong text overrule a wrong detected language', () => {
    const r = routeUtterance('hi', 'en', 'en-IN', 'मुझे पानी चाहिए', null);
    expect(r).toMatchObject({ speakerId: 'person_a', kind: 'text-override' });
  });
  it('takes the detected language when the text is mixed-script and undecided', () => {
    const r = routeUtterance('hi', 'en', 'hi-IN', 'मैं tomorrow office जा रहा हूँ', 'person_a');
    expect(r).toMatchObject({ speakerId: 'person_a', sourceLang: 'hi', kind: 'audio' });
    const e = routeUtterance('hi', 'en', 'en-IN', 'मैं tomorrow office जा रहा हूँ', 'person_b');
    expect(e).toMatchObject({ speakerId: 'person_b', sourceLang: 'en', targetLang: 'hi', kind: 'audio' });
  });
  it('alternates from the last speaker when nothing is known', () => {
    expect(routeUtterance('hi', 'en', undefined, '', 'person_a')).toMatchObject({ speakerId: 'person_b', kind: 'fallback' });
    expect(routeUtterance('hi', 'en', undefined, '', 'person_b')).toMatchObject({ speakerId: 'person_a', kind: 'fallback' });
    expect(routeUtterance('hi', 'en', undefined, '', null)).toMatchObject({ speakerId: 'person_a', kind: 'fallback' });
  });
  it('never drops an utterance whose detected language is outside the pair', () => {
    expect(routeUtterance('hi', 'mr', 'en-IN', '12345', 'person_a')).toMatchObject({ speakerId: 'person_b', kind: 'fallback' });
  });
});

describe('helpers', () => {
  it('primarySubtag', () => {
    expect(primarySubtag('hi-IN')).toBe('hi');
    expect(primarySubtag('en')).toBe('en');
  });
  it('wasGuessed is true only for non-text routes', () => {
    expect(wasGuessed('fallback')).toBe(true);
    expect(wasGuessed('audio')).toBe(true);
    expect(wasGuessed('text')).toBe(false);
    expect(wasGuessed('text-override')).toBe(false);
  });
  it('returnedItsInput ignores case, spacing and punctuation', () => {
    expect(returnedItsInput('Hello there.', 'hello  there')).toBe(true);
    expect(returnedItsInput('Hello', 'नमस्ते')).toBe(false);
  });
});
