// Language pairs and history for the Voice / Translate / Camera tabs.
// Deliberately separate from settingsStore: those two languages belong to the
// face-to-face Converse / Hands-free tabs, and changing a pair in one tab
// should not silently rewrite another's.

import { create } from 'zustand';
import { AUTO_LANG } from '../services/bharat/types';

export type BharatTab = 'voice' | 'translate' | 'camera';

export interface LangPair {
  readonly source: string; // BCP-47 short code, or AUTO_LANG (Translate / Camera)
  readonly target: string;
}

export interface RecentTranslation {
  readonly id: string;
  readonly sourceText: string;
  readonly translatedText: string;
  readonly sourceLang: string;
  readonly targetLang: string;
}

const MAX_RECENTS = 20;

interface BharatState {
  readonly pairs: { readonly [K in BharatTab]: LangPair };
  readonly recents: readonly RecentTranslation[];
}

interface BharatActions {
  setSource: (tab: BharatTab, code: string) => void;
  setTarget: (tab: BharatTab, code: string) => void;
  /** Swaps the pair; `resolvedSource` stands in for AUTO_LANG. */
  swap: (tab: BharatTab, resolvedSource?: string) => void;
  addRecent: (item: Omit<RecentTranslation, 'id'>) => void;
  clearRecents: () => void;
}

let nextId = 0;

export const useBharatStore = create<BharatState & BharatActions>(set => ({
  pairs: {
    voice: { source: 'hi', target: 'ta' },
    translate: { source: AUTO_LANG, target: 'en' },
    camera: { source: AUTO_LANG, target: 'en' },
  },
  recents: [],

  setSource: (tab, code) =>
    set(s => ({ pairs: { ...s.pairs, [tab]: { ...s.pairs[tab], source: code } } })),

  setTarget: (tab, code) =>
    set(s => ({ pairs: { ...s.pairs, [tab]: { ...s.pairs[tab], target: code } } })),

  swap: (tab, resolvedSource) =>
    set(s => {
      const { source, target } = s.pairs[tab];
      const from = source === AUTO_LANG ? resolvedSource : source;
      if (!from) return s;
      return { pairs: { ...s.pairs, [tab]: { source: target, target: from } } };
    }),

  addRecent: item =>
    set(s => {
      nextId += 1;
      const dup = s.recents.filter(
        r => !(r.sourceText === item.sourceText && r.targetLang === item.targetLang),
      );
      return { recents: [{ ...item, id: `r${nextId}` }, ...dup].slice(0, MAX_RECENTS) };
    }),

  clearRecents: () => set({ recents: [] }),
}));
