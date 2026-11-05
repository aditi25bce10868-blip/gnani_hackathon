// Welcome screen — BharatConnect's front door.
//
// (File keeps its old name so the 'LanguagePair' route and imports stay
// untouched.) There is no language picking here any more: Converse has its own
// language bar, and Translate / Camera have theirs. Start just makes sure the
// conversation has a sensible default pair and opens the tabs.

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSettingsStore } from '../store/settingsStore';
import { log } from '../services/log/logStore';
import type { RootStackParamList } from '../navigation/types';
import { Button, DuskBackdrop, Text, color, haptics, space } from '../ui';

type Props = NativeStackScreenProps<RootStackParamList, 'LanguagePair'>;

/** Used only when the user has never picked a language. */
const DEFAULT_SELF = 'hi';
const DEFAULT_OTHER = 'en';

export function LanguagePairScreen({ navigation }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const setPersonLanguage = useSettingsStore(s => s.setPersonLanguage);
  const setLanguagePairConfigured = useSettingsStore(s => s.setLanguagePairConfigured);

  const onStart = () => {
    // Read live so a returning user keeps the pair they chose last time.
    const { personA, personB } = useSettingsStore.getState();
    if (personA.language === '') setPersonLanguage('A', DEFAULT_SELF);
    if (personB.language === '') setPersonLanguage('B', DEFAULT_OTHER);
    log.info('[welcome] start');
    setLanguagePairConfigured(true);
    haptics.done();
    navigation.replace('Main');
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <DuskBackdrop />

      <View style={styles.hero}>
        <View style={styles.eyebrowRow}>
          <View style={[styles.dot, { backgroundColor: color.accentB }]} />
          <Text variant="caption" tone="fgGhost" style={styles.eyebrow}>
            BHARATCONNECT
          </Text>
          <View style={[styles.dot, { backgroundColor: color.accentA }]} />
        </View>
        <Text variant="serifHero" tone="fg" style={styles.headline}>
          Welcome to{'\n'}BharatConnect.
        </Text>
        <Text variant="serif" tone="fgFaint" style={styles.subhead}>
          Talk, type or point your camera — and understand every Indian language.
        </Text>
      </View>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space.md) }]}>
        <Button label="Start" onPress={onStart} style={styles.cta} />
        <Pressable
          onPress={() => navigation.navigate('Settings')}
          accessibilityRole="button"
          accessibilityLabel="Open settings">
          <Text variant="serif" tone="fgFaint" style={styles.settingsLink}>
            settings
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  hero: { flex: 1, justifyContent: 'center', paddingHorizontal: space.xl },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', marginBottom: space.md },
  dot: { width: 5, height: 5, borderRadius: 3, marginHorizontal: 8, opacity: 0.85 },
  eyebrow: { letterSpacing: 2.4 },
  headline: { marginRight: space.sm },
  subhead: { marginTop: space.md, paddingRight: space.xl, lineHeight: 22 },
  footer: { paddingHorizontal: space.xl, paddingTop: space.md, alignItems: 'center' },
  cta: { alignSelf: 'stretch', paddingVertical: 16, marginBottom: space.md, borderRadius: 16 },
  settingsLink: { paddingVertical: space.xs },
});
