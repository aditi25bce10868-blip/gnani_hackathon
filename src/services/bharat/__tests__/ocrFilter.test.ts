import { cleanOcrText, isUnchanged } from '../ocrFilter';

describe('cleanOcrText', () => {
  test.each(['bash', 'npm start -- --reset-cache', 'bash npm cache verify O www.warp.dev +1', 'www.warp.dev', '12345'])(
    'drops %s',
    t => expect(cleanOcrText(t)).toBe(''),
  );
  test('keeps real sentences', () => {
    expect(cleanOcrText('Use code with caution.')).toBe('Use code with caution.');
    expect(cleanOcrText('Git is a version control system.')).toBe('Git is a version control system.');
  });
  test('isUnchanged ignores case/space', () => expect(isUnchanged('Bash ', 'bash')).toBe(true));
});