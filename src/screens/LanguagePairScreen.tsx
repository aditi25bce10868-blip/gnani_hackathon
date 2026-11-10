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
import { Button, DuskBackdrop, Text, color, haptics, radius, space } from '../ui';

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
          <View style={[styles.dot, { backgroundColor: color.accent }]} />
          <Text variant="caption" tone="fg" style={styles.eyebrow}>
            BHARATCONNECT
          </Text>
          <View style={[styles.dot, { backgroundColor: color.accentSoft }]} />
        </View>

        <Text variant="serifHero" tone="fg" style={styles.headline}>
          Empowering India,{'\n'}In Every Tongue.
        </Text>

        <Text variant="serif" tone="fgMuted" style={styles.subhead}>
          Real-time voice AI, live conversation, and camera OCR translation across Indian languages.
        </Text>

        {/* Indic Language Pills Showcase */}
        <View style={styles.pillsContainer}>
          {['हिन्दी', 'தமிழ்', 'తెలుగు', 'বাংলা', 'ಕನ್ನಡ', 'മലയാളം', 'मराठी', 'ગુજરાતી'].map((lang, idx) => (
            <View key={idx} style={styles.langPill}>
              <Text variant="caption" tone="fgMuted" style={styles.langPillText}>
                {lang}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space.md) }]}>
        <Button label="Launch BharatConnect →" onPress={onStart} style={styles.cta} />
        <Pressable
          style={styles.settingsBtn}
          onPress={() => navigation.navigate('Settings')}
          accessibilityRole="button"
          accessibilityLabel="Open settings">
          <Text variant="serifSmall" tone="fgMuted">
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
  dot: { width: 6, height: 6, borderRadius: 3, marginHorizontal: 8 },
  eyebrow: { letterSpacing: 2.0, fontWeight: '700', fontSize: 10, color: color.accentSoft },
  headline: { marginRight: space.sm, fontSize: 34, lineHeight: 42, fontWeight: '300' },
  subhead: { marginTop: space.sm, paddingRight: space.md, lineHeight: 22 },
  pillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: space.lg,
    gap: 8,
  },
  langPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: color.bgElevated,
    borderWidth: 1,
    borderColor: color.border,
  },
  langPillText: {
    fontSize: 12,
    fontWeight: '500',
  },
  footer: { paddingHorizontal: space.xl, paddingTop: space.md, alignItems: 'center' },
  cta: {
    alignSelf: 'stretch',
    paddingVertical: 14,
    marginBottom: space.md,
    borderRadius: radius.pill,
    backgroundColor: color.primary,
  },
  settingsBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.borderStrong,
  },
});
