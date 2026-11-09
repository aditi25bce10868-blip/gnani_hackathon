import { mixFor, pairCanMix } from '../mixedSpeech';

test('Indian languages are heard together with English when mixing is on', () => {
  for (const l of ['hi', 'bn', 'mr', 'gu', 'pa', 'ta', 'te', 'kn', 'ml']) expect(mixFor(l, true)).toEqual(['en']);
});
test('mixing off → no hints', () => {
  expect(mixFor('hi', false)).toEqual([]);
});
test('English, Hinglish and non-Gnani languages never get hints', () => {
  for (const l of ['en', 'hi-hinglish', 'es', 'or', 'as', 'ur']) expect(mixFor(l, true)).toEqual([]);
});
test('the switch only matters when one side can mix', () => {
  expect(pairCanMix('hi', 'en')).toBe(true);
  expect(pairCanMix('en', 'ta')).toBe(true);
  expect(pairCanMix('en', 'es')).toBe(false);
  expect(pairCanMix('hi-hinglish', 'en')).toBe(false);
});
