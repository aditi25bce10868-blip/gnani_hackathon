// A translation result with Copy / Speak / Share actions.

import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Share, StyleSheet, View } from 'react-native';
import { getLanguage } from '../../app/languages';
import { writeClipboard } from '../../services/native/bharatSystem';
import { Surface, Text, color, haptics, radius, space } from '../../ui';
import { speakText } from './speak';

interface Props {
  /** Small label above the text, e.g. "You said" / "Translation". */
  readonly caption: string;
  readonly lang: string;
  readonly text: string;
  readonly busy?: boolean;
  readonly placeholder?: string;
  /** Accent for the caption dot. */
  readonly accent: string;
  /** Hide Copy/Speak/Share (used for the "you said" card). */
  readonly bare?: boolean;
}

export function ResultCard({
  caption,
  lang,
  text,
  busy = false,
  placeholder = '',
  accent,
  bare = false,
}: Props): React.JSX.Element {
  const [note, setNote] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const flash = (msg: string) => {
    setNote(msg);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setNote(''), 1800);
  };

  const hasText = text.trim() !== '';
  const language = lang ? getLanguage(lang) : null;

  const onCopy = async () => {
    haptics.tap();
    flash((await writeClipboard(text)) ? 'copied' : "couldn't copy");
  };
  const onSpeak = async () => {
    haptics.tap();
    const outcome = await speakText(text, lang);
    if (outcome === 'no-voice') {
      flash(`no ${language?.name ?? 'voice'} voice installed`);
    } else if (outcome === 'error') {
      flash("couldn't speak");
    }
  };
  const onShare = () => {
    haptics.tap();
    void Share.share({ message: text }).catch(() => {});
  };

  return (
    <Surface style={styles.card}>
      <View style={styles.head}>
        <View style={[styles.dot, { backgroundColor: accent }]} />
        <Text variant="serifSmall" tone="fgFaint">
          {caption}
          {language ? ` · ${language.name}` : ''}
        </Text>
        {busy ? <ActivityIndicator size="small" color={color.fgMuted} style={styles.spinner} /> : null}
      </View>
      {hasText ? (
        <Text variant="displayCompact" tone="fg" selectable style={styles.body}>
          {text}
        </Text>
      ) : (
        <Text variant="displayCompact" tone="fgGhost" style={styles.body}>
          {placeholder}
        </Text>
      )}
      {!bare && hasText ? (
        <View style={styles.actions}>
          <Action label="Copy" onPress={onCopy} />
          <Action label="Speak" onPress={onSpeak} />
          <Action label="Share" onPress={onShare} />
          {note ? (
            <Text variant="serifSmall" tone="ok" style={styles.note}>
              {note}
            </Text>
          ) : null}
        </View>
      ) : null}
    </Surface>
  );
}

function Action({ label, onPress }: { readonly label: string; readonly onPress: () => void }): React.JSX.Element {
  return (
    <Pressable onPress={onPress} hitSlop={6} style={styles.action} accessibilityRole="button">
      <Text variant="serifSmall" tone="fgMuted">
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: space.xl, marginTop: space.md, padding: space.lg },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: space.sm },
  dot: { width: 5, height: 5, borderRadius: 3, marginRight: 6 },
  spinner: { marginLeft: space.sm },
  body: { minHeight: 30, color: color.textPrimary },
  actions: { flexDirection: 'row', alignItems: 'center', marginTop: space.md },
  action: {
    marginRight: space.sm,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.borderStrong,
    backgroundColor: 'transparent',
  },
  note: { marginLeft: 'auto' },
});
