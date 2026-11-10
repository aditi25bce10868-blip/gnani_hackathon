// Welcome & Showcase screen — BharatConnect's front door.
//
// Displays the official BharatConnect identity:
// - Golden lotus mandala logo with ambient warm aura and gentle floating animation
// - Tagline: "Empowering India, In Every Tongue."
// - Three core features:
//     1. Intent- and Tone-Aware Translation (Hinglish -> Kannada)
//     2. Context-Aware Speech Correction (Hindi context repair & clarification)
//     3. Continuous Two-Way Conversation (Traveller <-> Conductor dialogue)
// - How It Works (Gnani AI Prisma STT, Evon LLM, Timbre TTS)
// - Eight supported Indian languages
// - Direct launch into live translation / conversation

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSettingsStore } from '../store/settingsStore';
import { log } from '../services/log/logStore';
import type { RootStackParamList } from '../navigation/types';
import { Button, DuskBackdrop, Text, color, haptics, radius, space } from '../ui';

type Props = NativeStackScreenProps<RootStackParamList, 'LanguagePair'>;

/** Default language pair for fresh installs */
const DEFAULT_SELF = 'hi';
const DEFAULT_OTHER = 'en';

const SUPPORTED_LANGS = [
  { native: 'हिन्दी', english: 'Hindi' },
  { native: 'தமிழ்', english: 'Tamil' },
  { native: 'తెలుగు', english: 'Telugu' },
  { native: 'বাংলা', english: 'Bengali' },
  { native: 'ಕನ್ನಡ', english: 'Kannada' },
  { native: 'മലയാളം', english: 'Malayalam' },
  { native: 'मराठी', english: 'Marathi' },
  { native: 'ગુજરાતી', english: 'Gujarati' },
  { native: 'हिंग्लिश', english: 'Hinglish' },
] as const;

export function LanguagePairScreen({ navigation }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const setPersonLanguage = useSettingsStore(s => s.setPersonLanguage);
  const setLanguagePairConfigured = useSettingsStore(s => s.setLanguagePairConfigured);

  // Smooth floating animation for the golden lotus logo
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -10,
          duration: 3200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 3200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [floatAnim]);

  const onStart = () => {
    const { personA, personB } = useSettingsStore.getState();
    if (personA.language === '') setPersonLanguage('A', DEFAULT_SELF);
    if (personB.language === '') setPersonLanguage('B', DEFAULT_OTHER);
    log.info('[welcome] launch BharatConnect');
    setLanguagePairConfigured(true);
    haptics.done();
    navigation.replace('Main');
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <DuskBackdrop />

      {/* Top Bar */}
      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          <Image
            source={require('../assets/bharatconnect-icon-1024-india.png')}
            style={styles.miniLogo}
            resizeMode="contain"
          />
          <Text variant="caption" tone="fg" style={styles.brandText}>
            BHARATCONNECT
          </Text>
        </View>

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

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={styles.logoContainer}>
            <View style={styles.auraGlow} />
            <Animated.View
              style={[
                styles.logoWrapper,
                { transform: [{ translateY: floatAnim }] },
              ]}>
              <Image
                source={require('../assets/bharatconnect-icon-1024-india.png')}
                style={styles.heroLogo}
                resizeMode="contain"
              />
            </Animated.View>
          </View>

          <View style={styles.eyebrowRow}>
            <View style={[styles.dot, { backgroundColor: color.accent }]} />
            <Text variant="caption" tone="fg" style={styles.eyebrow}>
              VOICE TRANSLATION FOR INDIA
            </Text>
            <View style={[styles.dot, { backgroundColor: color.accentSoft }]} />
          </View>

          <Text variant="serifHero" tone="fg" style={styles.headline}>
            Empowering India,{'\n'}
            <Text variant="serifHero" tone="fg" style={styles.headlineHighlight}>
              In Every Tongue.
            </Text>
          </Text>

          <Text variant="serif" tone="fgMuted" style={styles.subhead}>
            Real-time voice AI and live conversation across Indian languages.
          </Text>

          <Button
            label="Launch BharatConnect →"
            onPress={onStart}
            style={styles.heroCta}
          />
        </View>

        {/* How It Works */}
        <View style={styles.featureSection}>
          <Text variant="caption" tone="fg" style={styles.featureKick}>
            HOW IT WORKS
          </Text>
          <Text variant="displayCompact" tone="fg" style={styles.featureTitle}>
            Listen. Understand. <Text style={styles.italicHighlight}>Speak.</Text>
          </Text>

          <View style={styles.stepsContainer}>
            <View style={styles.stepCard}>
              <Text style={styles.stepNumber}>1</Text>
              <Text variant="body" tone="fg" style={styles.stepTitle}>Listen</Text>
              <Text variant="bodySmall" tone="fgMuted">
                Speech recognition powered by Gnani AI’s <Text style={styles.codeText}>Prisma</Text> engine.
              </Text>
            </View>

            <View style={styles.stepCard}>
              <Text style={styles.stepNumber}>2</Text>
              <Text variant="body" tone="fg" style={styles.stepTitle}>Understand</Text>
              <Text variant="bodySmall" tone="fgMuted">
                Tone & context reasoning powered by Gnani AI’s <Text style={styles.codeText}>Evon</Text>.
              </Text>
            </View>

            <View style={styles.stepCard}>
              <Text style={styles.stepNumber}>3</Text>
              <Text variant="body" tone="fg" style={styles.stepTitle}>Speak</Text>
              <Text variant="bodySmall" tone="fgMuted">
                Spoken output synthesis powered by Gnani AI’s <Text style={styles.codeText}>Timbre</Text>.
              </Text>
            </View>
          </View>
        </View>

        {/* Supported Languages */}
        <View style={styles.featureSection}>
          <Text variant="caption" tone="fg" style={styles.featureKick}>
            SUPPORTED LANGUAGES
          </Text>
          <Text variant="displayCompact" tone="fg" style={styles.featureTitle}>
            Nine languages, <Text style={styles.italicHighlight}>one conversation.</Text>
          </Text>

          <View style={styles.pillsContainer}>
            {SUPPORTED_LANGS.map((item, idx) => (
              <View key={idx} style={styles.langPill}>
                <Text style={styles.langPillNative}>{item.native}</Text>
                <Text style={styles.langPillEnglish}>{item.english}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Bottom Closing CTA */}
        <View style={styles.closingSection}>
          <Image
            source={require('../assets/bharatconnect-icon-1024-india.png')}
            style={styles.closingLogo}
            resizeMode="contain"
          />
          <Text variant="serifHero" tone="fg" style={styles.closingTitle}>
            Talk to all of India,{'\n'}
            <Text style={styles.italicHighlight}>in your own words.</Text>
          </Text>

          <Button
            label="Launch BharatConnect →"
            onPress={onStart}
            style={styles.bottomCta}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: color.border,
    backgroundColor: color.bg,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  miniLogo: { width: 24, height: 24, borderRadius: 12 },
  brandText: { letterSpacing: 1.6, fontWeight: '700', fontSize: 11, color: color.accentSoft },
  settingsBtn: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.borderStrong,
  },

  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 40 },

  // Hero
  heroSection: {
    alignItems: 'center',
    paddingHorizontal: space.xl,
    paddingTop: space.lg,
    paddingBottom: space.xxl,
    textAlign: 'center',
  },
  logoContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: space.md,
  },
  auraGlow: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: 'rgba(237, 158, 89, 0.18)',
  },
  logoWrapper: {
    width: 150,
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroLogo: {
    width: 150,
    height: 150,
    borderRadius: 75,
  },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', marginTop: space.sm, marginBottom: space.xs },
  dot: { width: 5, height: 5, borderRadius: 2.5, marginHorizontal: 8 },
  eyebrow: { letterSpacing: 1.8, fontWeight: '700', fontSize: 10, color: color.accent },
  headline: {
    textAlign: 'center',
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '300',
    marginTop: space.xs,
  },
  headlineHighlight: {
    color: color.accentSoft,
    fontStyle: 'italic',
  },
  subhead: {
    textAlign: 'center',
    marginTop: space.sm,
    lineHeight: 22,
    maxWidth: 320,
  },
  heroCta: {
    marginTop: space.xl,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: radius.pill,
    backgroundColor: color.primary,
  },

  // Feature Section
  featureSection: {
    paddingHorizontal: space.lg,
    marginTop: space.xl,
  },
  featureKick: {
    letterSpacing: 1.5,
    fontWeight: '700',
    fontSize: 10,
    color: color.accent,
    marginBottom: 4,
  },
  featureTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '400',
    marginBottom: 6,
  },
  italicHighlight: {
    fontStyle: 'italic',
    color: color.accentSoft,
  },
  featureDesc: {
    lineHeight: 20,
    marginBottom: space.md,
  },

  // Card
  card: {
    backgroundColor: color.bgSurface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.borderStrong,
    padding: space.md,
  },
  cardLabel: {
    fontSize: 9,
    letterSpacing: 1.2,
    fontWeight: '700',
    color: color.accent,
    marginBottom: 4,
  },
  cardLabelKannada: {
    fontSize: 9,
    letterSpacing: 1.2,
    fontWeight: '700',
    color: color.accentSoft,
    marginBottom: 4,
  },
  cardInput: {
    fontSize: 15,
    lineHeight: 22,
    color: color.fg,
  },
  cardOutput: {
    fontSize: 18,
    lineHeight: 26,
    color: color.fg,
    marginBottom: 6,
  },
  cardNote: {
    lineHeight: 18,
    color: color.fgMuted,
  },
  divider: {
    height: 1,
    backgroundColor: color.border,
    marginVertical: space.sm,
  },

  // Correction badge
  correctionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 6,
  },
  correctedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(237, 158, 89, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  strikeText: {
    color: color.accentSoft,
    textDecorationLine: 'line-through',
    fontSize: 14,
  },
  correctText: {
    color: color.accent,
    fontWeight: '700',
    fontSize: 14,
  },
  clarifyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  chip: {
    backgroundColor: color.bgElevated,
    borderWidth: 1,
    borderColor: color.borderStrong,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    marginHorizontal: 3,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '600',
    color: color.fg,
  },

  // Dialogue Bubbles
  dialogueContainer: {
    gap: 10,
  },
  bubbleLeft: {
    alignSelf: 'flex-start',
    backgroundColor: color.bgSurface,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '85%',
  },
  bubbleRight: {
    alignSelf: 'flex-end',
    backgroundColor: '#35294A',
    borderWidth: 1,
    borderColor: 'rgba(237, 158, 89, 0.25)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '85%',
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 22,
    color: color.fg,
  },
  bubbleSub: {
    marginTop: 4,
    color: color.fgMuted,
  },
  bubbleSubRight: {
    marginTop: 4,
    color: color.accentSoft,
  },

  // Steps
  stepsContainer: {
    gap: 10,
  },
  stepCard: {
    backgroundColor: color.bgSurface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    padding: space.md,
  },
  stepNumber: {
    fontSize: 22,
    fontFamily: 'serif',
    fontStyle: 'italic',
    fontWeight: '700',
    color: color.accent,
    marginBottom: 4,
  },
  stepTitle: {
    fontWeight: '700',
    marginBottom: 4,
  },
  codeText: {
    color: color.accentSoft,
    fontWeight: '700',
  },

  // Pills
  pillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  langPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: color.bgElevated,
    borderWidth: 1,
    borderColor: color.border,
  },
  langPillNative: {
    color: color.fg,
    fontSize: 14,
    fontWeight: '500',
  },
  langPillEnglish: {
    color: color.fgMuted,
    fontSize: 11,
  },

  // Closing
  closingSection: {
    alignItems: 'center',
    textAlign: 'center',
    marginTop: space.xxl,
    paddingHorizontal: space.xl,
    paddingBottom: space.xl,
  },
  closingLogo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: space.sm,
  },
  closingTitle: {
    textAlign: 'center',
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '300',
    marginBottom: space.lg,
  },
  bottomCta: {
    alignSelf: 'stretch',
    paddingVertical: 14,
    borderRadius: radius.pill,
    backgroundColor: color.primary,
  },
});
