// Cleans OCR blocks before translation: code-fence labels ("bash"), shell
// commands, URLs and citation chips ("www.warp.dev +1", "Stack Overflow +1")
// are not text a person wants translated, so they are dropped or trimmed.

const CODE_LABELS = new Set([
  'bash', 'sh', 'shell', 'zsh', 'cmd', 'powershell', 'terminal', 'console', 'json', 'yaml', 'xml', 'html', 'css',
  'js', 'javascript', 'ts', 'typescript', 'tsx', 'jsx', 'python', 'java', 'kotlin', 'swift', 'sql', 'text', 'copy',
]);

const COMMANDS =
  'npm|npx|yarn|pnpm|git|pip|pip3|python|python3|node|cd|ls|sudo|brew|apt|apt-get|docker|curl|wget|rm|mkdir|cp|mv|adb|gradle|gradlew|pod|java|go|cargo|chmod|export|cat|echo';

const CHIP_DOMAIN = /\b(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/\S*)?(?:\s*\+\d*)?/gi;
const CHIP_SOURCE = /\b(?:Stack\s*Overflow|GitHub|Reddit|Medium|Quora|YouTube)\s*\+\d*/gi;
const CODE_PREFIX = new RegExp(`^(?:${[...CODE_LABELS].join('|')})\\s+`, 'i');
const COMMAND_LINE = new RegExp(`^(?:\\$\\s*)?(?:${COMMANDS})\\b(.*)$`, 'i');

/** Trim code labels / link chips off a block; '' when nothing worth translating is left. */
export function cleanOcrText(raw: string): string {
  let t = raw.replace(CHIP_SOURCE, ' ').replace(CHIP_DOMAIN, ' ');
  t = t.replace(/\s[O•·▢□]\s*$/u, ' ').replace(/\s+/g, ' ').trim();
  const bare = t.toLowerCase();
  if (CODE_LABELS.has(bare)) return '';
  // "bash npm cache verify" → the label goes; what is left is a command → dropped below.
  const labelled = CODE_PREFIX.exec(t);
  if (labelled && COMMAND_LINE.test(t.slice(labelled[0].length))) t = t.slice(labelled[0].length);
  if (!/\p{L}/u.test(t)) return '';
  if (looksLikeCommand(t)) return '';
  return t;
}

function looksLikeCommand(t: string): boolean {
  const m = COMMAND_LINE.exec(t);
  if (!m) return false;
  const rest = m[1].trim();
  if (rest === '') return true;
  if (/(^|\s)--?[a-z]/i.test(rest)) return true; // has a flag
  if (/[.!?:,;]$/.test(rest) || /[A-Z]/.test(rest)) return false; // reads like a sentence
  // A sentence ends with punctuation / has capitals; a command is short lowercase words.
  return rest.split(/\s+/).length <= 5 && /^[a-z0-9._/@:=~-]+(?:\s+[a-z0-9._/@:=~-]+)*$/.test(rest);
}

/** True when the "translation" is just the original coming back (names, code, numbers). */
export function isUnchanged(original: string, translated: string): boolean {
  return original.trim().toLowerCase() === translated.trim().toLowerCase();
}