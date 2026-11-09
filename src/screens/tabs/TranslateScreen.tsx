// Translate tab — Google-Translate-style.
//  • auto-detects the source language,
//  • translates as you type (debounced),
//  • picks up text from OTHER apps: Share → BharatConnect, the text-selection
//    menu, or the clipboard chip ("translate what you just copied"),
//  • keeps recent translations.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { errorMessage } from '../../app/errors';
import { getLanguage } from '../../app/languages';
import { translateProvider } from '../../services/bharat/providers';
import { detectLanguage } from '../../services/bharat/scriptDetect';
import { AUTO_LANG } from '../../services/bharat/types';
import { readClipboard } from '../../services/native/bharatSystem';
import { useBharatStore, type RecentTranslation } from '../../store/bharatStore';
import type { MainNavigation } from '../../navigation/types';
import { DuskBackdrop, Surface, Text, color, font, haptics, space } from '../../ui';
import { LangPairBar, useLangPicker } from '../bharat/LangPairBar';
import { ResultCard } from '../bharat/ResultCard';
import { ScreenHeader } from '../bharat/ScreenHeader';
import { stopSpeaking } from '../bharat/speak';

const MAX_CHARS = 2000;
// Each pause is one request against a free daily quota, so wait a little longer.
const LIVE_DEBOUNCE_MS = 900;
const RECENT_SETTLE_MS = 2000;

export interface IncomingText {
  readonly text: string;
  /** Changes on every delivery so the same text can arrive twice. */
  readonly id: number;
}

interface Props {
  readonly navigation: MainNavigation;
  readonly incoming?: IncomingText | null;
}

export function TranslateScreen({ navigation, incoming }: Props): React.JSX.Element {
  const pair = useBharatStore(s => s.pairs.translate);
  const setSource = useBharatStore(s => s.setSource);
  const setTarget = useBharatStore(s => s.setTarget);
  const swap = useBharatStore(s => s.swap);
  const recents = useBharatStore(s => s.recents);
  const addRecent = useBharatStore(s => s.addRecent);
  const clearRecents = useBharatStore(s => s.clearRecents);

  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [detected, setDetected] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [clip, setClip] = useState('');
  const run = useRef(0);
  const lastClipSeen = useRef('');
  const recentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const picker = useLangPicker({
    source: pair.source,
    target: pair.target,
    onSource: c => setSource('translate', c),
    onTarget: c => setTarget('translate', c),
  });

  useEffect(
    () => () => {
      run.current += 1;
      if (recentTimer.current) clearTimeout(recentTimer.current);
      stopSpeaking();
    },
    [],
  );

  // Text handed over from another app.
  useEffect(() => {
    if (incoming && incoming.text.trim() !== '') setInput(incoming.text.slice(0, MAX_CHARS));
  }, [incoming]);

  // "Translate copied text" chip: look at the clipboard when the tab opens and
  // whenever the app returns to the foreground.
  const checkClipboard = useCallback(async () => {
    const text = (await readClipboard()).trim();
    if (text !== '' && text !== lastClipSeen.current && text !== input.trim()) {
      lastClipSeen.current = text;
      setClip(text);
    }
  }, [input]);

  useEffect(() => {
    void checkClipboard();
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') void checkClipboard();
    });
    return () => sub.remove();
    // Only on mount / foreground — typing must not re-poll the clipboard.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live translation, debounced.
  useEffect(() => {
    const text = input.trim();
    if (text === '') {
      run.current += 1;
      setOutput('');
      setDetected('');
      setBusy(false);
      setError('');
      return;
    }
    const id = ++run.current;
    setBusy(true);
    const timer = setTimeout(() => {
      translateProvider
        .translate({ text, sourceLang: pair.source, targetLang: pair.target })
        .then(out => {
          if (id !== run.current) return;
          setOutput(out.text);
          setDetected(out.detectedLang ?? detectLanguage(text));
          setError('');
          // Live translation fires on every pause while typing; only a
          // translation that then stands for a moment earns a "recent" slot.
          if (recentTimer.current) clearTimeout(recentTimer.current);
          recentTimer.current = setTimeout(() => {
            addRecent({
              sourceText: text,
              translatedText: out.text,
              sourceLang: out.detectedLang ?? pair.source,
              targetLang: pair.target,
            });
          }, RECENT_SETTLE_MS);
        })
        .catch(e => {
          if (id === run.current) setError(errorMessage(e));
        })
        .finally(() => {
          if (id === run.current) setBusy(false);
        });
    }, LIVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [input, pair.source, pair.target, addRecent]);

  const onSwap = () => {
    swap('translate', detected);
    setInput(output);
  };

  const reuseRecent = (r: RecentTranslation) => {
    haptics.tick();
    setSource('translate', AUTO_LANG);
    setTarget('translate', r.targetLang);
    setInput(r.sourceText);
  };

  return (
    <View style={styles.root}>
      <DuskBackdrop />
      <ScreenHeader
        eyebrow="TRANSLATE"
        title="Any text, anywhere."
        engineNote={translateProvider.isMock ? 'demo engine — real translation coming soon' : undefined}
        onSettings={() => navigation.navigate('Settings')}
      />
      <LangPairBar
        source={pair.source}
        target={pair.target}
        onPressSource={picker.openSource}
        onPressTarget={picker.openTarget}
        onSwap={onSwap}
        swapDisabled={pair.source === AUTO_LANG && detected === ''}
        onAuto={() => setSource('translate', AUTO_LANG)}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled">
        {clip !== '' && input.trim() === '' ? (
          <Pressable
            style={styles.clipChip}
            onPress={() => {
              haptics.tap();
              setInput(clip.slice(0, MAX_CHARS));
              setClip('');
            }}
            accessibilityRole="button"
            accessibilityLabel="Translate copied text">
            <Text variant="caption" tone="fgFaint" style={styles.clipEyebrow}>
              TRANSLATE COPIED TEXT
            </Text>
            <Text variant="bodySmall" tone="fgMuted" numberOfLines={2}>
              {clip}
            </Text>
          </Pressable>
        ) : null}

        <Surface style={styles.inputCard}>
          {pair.source === AUTO_LANG && detected !== '' ? (
            <Text variant="serifSmall" tone="fgFaint" style={styles.detected}>
              detected · {getLanguage(detected).name}
            </Text>
          ) : null}
          <TextInput
            value={input}
            onChangeText={t => setInput(t.slice(0, MAX_CHARS))}
            placeholder="Type, paste, or share text here"
            placeholderTextColor={color.fgGhost}
            multiline
            textAlignVertical="top"
            style={styles.input}
            accessibilityLabel="Text to translate"
          />
          {input !== '' ? (
            <Pressable onPress={() => setInput('')} hitSlop={10} style={styles.clear} accessibilityRole="button">
              <Text variant="serif" tone="fgMuted">
                Clear
              </Text>
            </Pressable>
          ) : null}
        </Surface>

        {error !== '' ? (
          <Text variant="bodySmall" tone="error" style={styles.error}>
            {error}
          </Text>
        ) : null}

        {input.trim() !== '' ? (
          <ResultCard
            caption="Translation"
            lang={pair.target}
            text={output}
            accent={color.accentB}
            busy={busy}
            placeholder="Translating…"
          />
        ) : null}

        {recents.length > 0 && input.trim() === '' ? (
          <View style={styles.recents}>
            <View style={styles.recentsHead}>
              <Text variant="caption" tone="fgFaint" style={styles.clipEyebrow}>
                RECENT
              </Text>
              <Pressable onPress={clearRecents} hitSlop={10} accessibilityRole="button">
                <Text variant="serifSmall" tone="fgFaint">
                  clear
                </Text>
              </Pressable>
            </View>
            {recents.slice(0, 8).map(r => (
              <Pressable key={r.id} style={styles.recent} onPress={() => reuseRecent(r)} accessibilityRole="button">
                <Text variant="bodySmall" tone="fgMuted" numberOfLines={1}>
                  {r.sourceText}
                </Text>
                <Text variant="body" tone="fg" numberOfLines={1}>
                  {r.translatedText}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </ScrollView>
      {picker.sheet}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: space.md, paddingBottom: space.xl },
  clipChip: {
    marginHorizontal: space.xl,
    marginBottom: space.md,
    padding: space.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: color.hairlineStrong,
    backgroundColor: color.bgElevated,
  },
  clipEyebrow: { letterSpacing: 2, marginBottom: 4 },
  inputCard: { marginHorizontal: space.xl, padding: space.lg },
  detected: { marginBottom: space.xs },
  input: {
    ...font.displayCompact,
    color: color.fg,
    minHeight: 110,
    maxHeight: 220,
    padding: 0,
  },
  clear: { alignSelf: 'flex-end', marginTop: space.sm },
  error: { marginHorizontal: space.xl, marginTop: space.md },
  recents: { marginTop: space.lg, paddingHorizontal: space.xl },
  recentsHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.xs },
  recent: {
    paddingVertical: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.hairline,
  },
});
