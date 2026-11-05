// MainTabs — BharatConnect's five-tab shell.
//
//   Converse   · two people, one phone, tap/hold-to-talk   (Parly conversation)
//   Voice      · speak once, hear it translated            (BHASHINI-style)
//   Translate  · type / paste / share, auto-detect, live   (BHASHINI + Google style, one tab)
//   Camera     · point at any printed text, read it translated
//   Hands-free · Converse with on-device VAD turn-taking   (Parly hands-free; quiet places)
//
// Only the ACTIVE tab is mounted. That is deliberate: every tab that touches
// the microphone tears its audio down on unmount, so switching tabs can never
// leave the mic open behind the user's back.

import React, { useEffect, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { getInitialSharedText, onSharedText } from '../services/native/bharatSystem';
import { Text, color, haptics } from '../ui';
import { ConversationScreen } from './ConversationScreen';
import { TabIcon, type TabIconName } from './bharat/TabIcons';
import { CameraScreen } from './tabs/CameraScreen';
import { TranslateScreen, type IncomingText } from './tabs/TranslateScreen';
import { VoiceScreen } from './tabs/VoiceScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'Main'>;

type TabId = TabIconName;

const TABS: readonly { readonly id: TabId; readonly label: string }[] = [
  { id: 'converse', label: 'Converse' },
  { id: 'voice', label: 'Voice' },
  { id: 'translate', label: 'Translate' },
  { id: 'camera', label: 'Camera' },
  { id: 'handsfree', label: 'Hands-free' },
];

export function MainTabs({ navigation }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<TabId>('converse');
  const [incoming, setIncoming] = useState<IncomingText | null>(null);
  const [keyboardUp, setKeyboardUp] = useState(false);

  // Text arriving from another app (Share / selection menu) lands on Translate.
  useEffect(() => {
    let n = 0;
    const deliver = (text: string) => {
      if (text.trim() === '') return;
      n += 1;
      setIncoming({ text, id: n });
      setTab('translate');
    };
    void getInitialSharedText().then(t => {
      if (t) deliver(t);
    });
    return onSharedText(deliver);
  }, []);

  // The bar steps aside while typing so the keyboard gets the room.
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardUp(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardUp(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // The bar sits below the screens, so the screens must not also reserve the
  // bottom inset themselves.
  const screenInsets = { ...insets, bottom: 0 };

  return (
    <View style={styles.root}>
      <SafeAreaInsetsContext.Provider value={screenInsets}>
        <View style={[styles.content, tab !== 'converse' && tab !== 'handsfree' && { paddingTop: insets.top }]}>
          {tab === 'converse' && <ConversationScreen navigation={navigation} variant="ptt" />}
          {tab === 'voice' && <VoiceScreen navigation={navigation} />}
          {tab === 'translate' && <TranslateScreen navigation={navigation} incoming={incoming} />}
          {tab === 'camera' && <CameraScreen navigation={navigation} />}
          {tab === 'handsfree' && <ConversationScreen navigation={navigation} variant="handsfree" />}
        </View>
      </SafeAreaInsetsContext.Provider>

      {!keyboardUp && (
        <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          {TABS.map(t => {
            const active = t.id === tab;
            const tint = active ? color.accentA : color.fgFaint;
            return (
              <Pressable
                key={t.id}
                style={styles.tab}
                onPress={() => {
                  if (!active) haptics.tick();
                  setTab(t.id);
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={t.label}>
                <TabIcon name={t.id} color={tint} size={22} />
                <Text variant="serifSmall" style={[styles.label, { color: tint }]}>
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  content: { flex: 1 },
  bar: {
    flexDirection: 'row',
    backgroundColor: color.bgElevated,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.hairlineStrong,
    paddingTop: 8,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 2 },
  label: { marginTop: 3, fontSize: 10 },
});
