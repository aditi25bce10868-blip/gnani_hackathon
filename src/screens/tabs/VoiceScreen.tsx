// Voice tab — BHASHINI-style speech-to-speech.
// Pick two languages, tap the mic, speak, tap again: the app shows what it
// heard, the translation, and reads the translation aloud. One direction at a
// time; swap to answer. (Two people, one phone → the Converse tab.)

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { errorMessage } from '../../app/errors';
import { getLanguage } from '../../app/languages';
import { createSttProvider } from '../../services/bharat/providers';
import { translateProvider } from '../../services/bharat/providers';
import { useBharatStore } from '../../store/bharatStore';
import type { MainNavigation } from '../../navigation/types';
import { DuskBackdrop, Text, color, haptics, space } from '../../ui';
import { LangPairBar, useLangPicker } from '../bharat/LangPairBar';
import { ResultCard } from '../bharat/ResultCard';
import { ScreenHeader } from '../bharat/ScreenHeader';
import { speakText, stopSpeaking } from '../bharat/speak';
import { MicGlyph } from '../bharat/TabIcons';

type Stage = 'idle' | 'listening' | 'transcribing' | 'translating' | 'speaking';

const STAGE_LABEL: { readonly [K in Stage]: string } = {
  idle: 'Tap to speak',
  listening: 'Listening… tap to finish',
  transcribing: 'Understanding…',
  translating: 'Translating…',
  speaking: 'Speaking… tap to stop',
};

interface Props {
  readonly navigation: MainNavigation;
}

export function VoiceScreen({ navigation }: Props): React.JSX.Element {
  const pair = useBharatStore(s => s.pairs.voice);
  const setSource = useBharatStore(s => s.setSource);
  const setTarget = useBharatStore(s => s.setTarget);
  const swap = useBharatStore(s => s.swap);

  const stt = useMemo(() => createSttProvider(), []);
  const [stage, setStage] = useState<Stage>('idle');
  const [heard, setHeard] = useState('');
  const [translated, setTranslated] = useState('');
  const [error, setError] = useState('');
  const run = useRef(0);

  const picker = useLangPicker({
    source: pair.source,
    target: pair.target,
    onSource: c => setSource('voice', c),
    onTarget: c => setTarget('voice', c),
  });

  // Leaving the tab must never leave a recording or a voice running.
  useEffect(
    () => () => {
      run.current += 1;
      stt.cancel();
      stopSpeaking();
    },
    [stt],
  );

  const process = useCallback(async () => {
    const id = run.current;
    try {
      setStage('transcribing');
      const heardResult = await stt.stop();
      if (id !== run.current) return;
      setHeard(heardResult.text);
      if (heardResult.text.trim() === '') {
        setError("Didn't catch that — try again.");
        setStage('idle');
        return;
      }
      setStage('translating');
      const out = await translateProvider.translate({
        text: heardResult.text,
        sourceLang: pair.source,
        targetLang: pair.target,
      });
      if (id !== run.current) return;
      setTranslated(out.text);
      haptics.done();
      setStage('speaking');
      const outcome = await speakText(out.text, pair.target);
      if (id !== run.current) return;
      if (outcome === 'no-voice') {
        setError(`No ${getLanguage(pair.target).name} voice installed on this phone — showing text only.`);
      }
      setStage('idle');
    } catch (e) {
      if (id !== run.current) return;
      setError(errorMessage(e));
      setStage('idle');
    }
  }, [pair.source, pair.target, stt]);

  const onMic = useCallback(async () => {
    if (stage === 'transcribing' || stage === 'translating') return;
    haptics.tap();
    if (stage === 'speaking') {
      run.current += 1;
      stopSpeaking();
      setStage('idle');
      return;
    }
    if (stage === 'listening') {
      await process();
      return;
    }
    setError('');
    run.current += 1;
    try {
      await stt.start(pair.source);
      setStage('listening');
    } catch (e) {
      setError(errorMessage(e));
      setStage('idle');
    }
  }, [stage, process, stt, pair.source]);

  const onSwap = () => {
    if (stage !== 'idle') return;
    swap('voice');
    setHeard(translated);
    setTranslated(heard);
  };

  return (
    <View style={styles.root}>
      <DuskBackdrop />
      <ScreenHeader
        eyebrow="VOICE"
        title="Speak, and be understood."
        engineNote={translateProvider.isMock ? 'demo engine — real speech coming soon' : undefined}
        onSettings={() => navigation.navigate('Settings')}
      />
      <LangPairBar
        source={pair.source}
        target={pair.target}
        onPressSource={picker.openSource}
        onPressTarget={picker.openTarget}
        onSwap={onSwap}
        swapDisabled={stage !== 'idle'}
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <ResultCard
          caption="You said"
          lang={pair.source}
          text={heard}
          accent={color.accentA}
          bare
          placeholder="Your words appear here."
        />
        <ResultCard
          caption="Translation"
          lang={pair.target}
          text={translated}
          accent={color.accentB}
          busy={stage === 'translating'}
          placeholder="The translation appears here."
        />
        {error !== '' ? (
          <Text variant="bodySmall" tone="warn" style={styles.error}>
            {error}
          </Text>
        ) : null}
      </ScrollView>

      <View style={styles.micWrap}>
        <MicButton stage={stage} onPress={() => void onMic()} />
        <Text variant="serif" tone="fgMuted" style={styles.stageLabel}>
          {STAGE_LABEL[stage]}
        </Text>
      </View>
      {picker.sheet}
    </View>
  );
}

function MicButton({ stage, onPress }: { readonly stage: Stage; readonly onPress: () => void }): React.JSX.Element {
  const pulse = useSharedValue(0);
  const listening = stage === 'listening';
  const working = stage === 'transcribing' || stage === 'translating';

  useEffect(() => {
    if (listening) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
          withTiming(0, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
      );
    } else {
      cancelAnimation(pulse);
      pulse.value = withTiming(0, { duration: 200 });
    }
  }, [listening, pulse]);

  const ring = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + 0.4 * pulse.value }],
    opacity: listening ? 0.55 - 0.4 * pulse.value : 0,
  }));

  return (
    <View style={styles.micBox}>
      <Animated.View style={[styles.micRing, ring]} />
      <Pressable
        onPress={onPress}
        disabled={working}
        style={[styles.mic, listening && styles.micLive]}
        accessibilityRole="button"
        accessibilityLabel={STAGE_LABEL[stage]}>
        {working ? (
          <ActivityIndicator color={color.fgMuted} />
        ) : (
          <MicGlyph color={listening ? color.fgInk : color.fg} size={34} />
        )}
      </Pressable>
    </View>
  );
}

const MIC = 84;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: space.lg },
  error: { marginHorizontal: space.xl, marginTop: space.md },
  micWrap: { alignItems: 'center', paddingTop: space.sm, paddingBottom: space.lg },
  stageLabel: { marginTop: space.sm },
  micBox: { width: MIC + 40, height: MIC + 40, alignItems: 'center', justifyContent: 'center' },
  micRing: {
    position: 'absolute',
    width: MIC,
    height: MIC,
    borderRadius: MIC / 2,
    backgroundColor: color.accentARing,
  },
  mic: {
    width: MIC,
    height: MIC,
    borderRadius: MIC / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surface3,
    borderWidth: 1,
    borderColor: color.discBorder,
  },
  micLive: { backgroundColor: color.accentA, borderColor: color.accentA },
});
