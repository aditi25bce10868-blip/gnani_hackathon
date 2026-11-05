// Demo engine. Lets every BharatConnect screen be exercised end to end before
// Gnani / the LLM / IndicTrans2 are wired in. Anything outside the tiny
// phrasebook comes back visibly tagged ⟦demo⟧ so it can never be mistaken for
// a real translation.

import { detectLanguage } from './scriptDetect';
import {
  AUTO_LANG,
  type SttProvider,
  type SttResult,
  type TranslateProvider,
  type TranslateRequest,
  type TranslateResult,
} from './types';

interface Phrase {
  readonly [lang: string]: string;
}

const PHRASEBOOK: readonly Phrase[] = [
  {
    en: 'How much is this?',
    hi: 'यह कितने का है?',
    'hi-hinglish': 'Yeh kitne ka hai?',
    bn: 'এটার দাম কত?',
    mr: 'हे किती रुपयांना आहे?',
    ta: 'இது எவ்வளவு?',
    te: 'ఇది ఎంత?',
    kn: 'ಇದರ ಬೆಲೆ ಎಷ್ಟು?',
    ml: 'ഇതിന് എത്രയാണ് വില?',
  },
  {
    en: 'Where is the railway station?',
    hi: 'रेलवे स्टेशन कहाँ है?',
    'hi-hinglish': 'Railway station kahan hai?',
    bn: 'রেলওয়ে স্টেশন কোথায়?',
    mr: 'रेल्वे स्टेशन कुठे आहे?',
    ta: 'ரயில் நிலையம் எங்கே?',
    te: 'రైల్వే స్టేషన్ ఎక్కడ ఉంది?',
    kn: 'ರೈಲು ನಿಲ್ದಾಣ ಎಲ್ಲಿದೆ?',
    ml: 'റെയിൽവേ സ്റ്റേഷൻ എവിടെയാണ്?',
  },
  {
    en: 'Thank you',
    hi: 'धन्यवाद',
    'hi-hinglish': 'Dhanyavaad',
    bn: 'ধন্যবাদ',
    mr: 'धन्यवाद',
    ta: 'நன்றி',
    te: 'ధన్యవాదాలు',
    kn: 'ಧನ್ಯವಾದಗಳು',
    ml: 'നന്ദി',
  },
];

const DELAY_MS = 450;

function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[?।.!,]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function findPhrase(text: string): Phrase | undefined {
  const needle = normalise(text);
  if (needle === '') return undefined;
  return PHRASEBOOK.find(p => Object.values(p).some(v => normalise(v) === needle));
}

export class MockTranslateProvider implements TranslateProvider {
  readonly name = 'Demo engine';
  readonly isMock = true;

  async translate(req: TranslateRequest): Promise<TranslateResult> {
    await sleep(DELAY_MS);
    const detected = req.sourceLang === AUTO_LANG ? detectLanguage(req.text) : req.sourceLang;
    const hit = findPhrase(req.text);
    const out = hit?.[req.targetLang];
    if (out !== undefined) return { text: out, detectedLang: detected };
    return {
      text: `⟦demo · ${detected || '?'}→${req.targetLang}⟧ ${req.text}`,
      detectedLang: detected,
    };
  }
}

export class MockSttProvider implements SttProvider {
  readonly name = 'Demo engine';
  readonly isMock = true;
  private lang = 'hi';
  private n = 0;

  async start(lang: string): Promise<void> {
    this.lang = lang;
  }

  async stop(): Promise<SttResult> {
    await sleep(DELAY_MS);
    const phrase = PHRASEBOOK[this.n % PHRASEBOOK.length];
    this.n += 1;
    const text = phrase[this.lang] ?? phrase.en;
    return { text, lang: phrase[this.lang] === undefined ? 'en' : this.lang, confidence: 1 };
  }

  cancel(): void {
    // Nothing is held open by the demo engine.
  }
}
