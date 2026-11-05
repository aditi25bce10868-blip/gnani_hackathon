// Source ⇄ target selector shared by Voice, Text and Translate.
//
// The language sheet is an absolute-fill overlay, so it has to be mounted as
// the LAST child of the screen's root view (later siblings paint on top).
// `useLangPicker` therefore hands the screen a `sheet` element to place there,
// and the bar itself stays a plain row.

import React, { useCallback, useState, type ReactElement } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { getLanguage } from '../../app/languages';
import { AUTO_LANG } from '../../services/bharat/types';
import { LanguagePickerSheet, Text, color, haptics, radius, space } from '../../ui';

type Slot = 'source' | 'target';

interface PickerOptions {
  readonly source: string;
  readonly target: string;
  readonly onSource: (code: string) => void;
  readonly onTarget: (code: string) => void;
}

export function useLangPicker({ source, target, onSource, onTarget }: PickerOptions): {
  readonly openSource: () => void;
  readonly openTarget: () => void;
  readonly sheet: ReactElement;
} {
  const [slot, setSlot] = useState<Slot | null>(null);
  const openSource = useCallback(() => setSlot('source'), []);
  const openTarget = useCallback(() => setSlot('target'), []);
  const close = useCallback(() => setSlot(null), []);

  const exclude =
    slot === 'source' ? target : slot === 'target' && source !== AUTO_LANG ? source : undefined;

  const sheet = (
    <LanguagePickerSheet
      visible={slot !== null}
      excludeCode={exclude}
      onSelect={code => {
        haptics.tick();
        if (slot === 'source') onSource(code);
        else if (slot === 'target') onTarget(code);
        setSlot(null);
      }}
      onClose={close}
    />
  );
  return { openSource, openTarget, sheet };
}

interface BarProps {
  readonly source: string;
  readonly target: string;
  readonly onPressSource: () => void;
  readonly onPressTarget: () => void;
  readonly onSwap: () => void;
  readonly swapDisabled?: boolean;
  /** Translate tab: lets the source go back to "Detect language". */
  readonly onAuto?: () => void;
}

function Chip({
  code,
  accent,
  onPress,
  caption,
}: {
  readonly code: string;
  readonly accent: string;
  readonly onPress: () => void;
  readonly caption: string;
}): React.JSX.Element {
  const isAuto = code === AUTO_LANG;
  const lang = isAuto ? null : getLanguage(code);
  return (
    <Pressable
      style={styles.chip}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${caption}: ${lang ? lang.name : 'Detect language'}`}>
      <View style={styles.chipTop}>
        <View style={[styles.dot, { backgroundColor: accent }]} />
        <Text variant="serifSmall" tone="fgFaint">
          {caption}
        </Text>
      </View>
      <Text variant="body" tone="fg" numberOfLines={1} style={styles.chipName}>
        {lang ? lang.endonym : 'Detect language'}
      </Text>
      {lang && lang.endonym !== lang.name ? (
        <Text variant="serifSmall" tone="fgMuted" numberOfLines={1}>
          {lang.name}
        </Text>
      ) : null}
    </Pressable>
  );
}

export function LangPairBar({
  source,
  target,
  onPressSource,
  onPressTarget,
  onSwap,
  swapDisabled = false,
  onAuto,
}: BarProps): React.JSX.Element {
  return (
    <View>
      <View style={styles.row}>
        <Chip code={source} accent={color.accentA} onPress={onPressSource} caption="from" />
        <Pressable
          style={[styles.swap, swapDisabled && styles.swapDisabled]}
          disabled={swapDisabled}
          onPress={() => {
            haptics.tick();
            onSwap();
          }}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Swap languages">
          <Svg width={20} height={20} viewBox="0 0 24 24">
            <Path
              d="M7 7h12M16 4l3 3-3 3M17 17H5M8 14l-3 3 3 3"
              stroke={color.fgMuted}
              strokeWidth={1.7}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </Svg>
        </Pressable>
        <Chip code={target} accent={color.accentB} onPress={onPressTarget} caption="to" />
      </View>
      {onAuto && source !== AUTO_LANG ? (
        <Pressable onPress={onAuto} hitSlop={10} style={styles.auto} accessibilityRole="button">
          <Text variant="serifSmall" tone="fgFaint">
            use auto-detect
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'stretch', paddingHorizontal: space.xl },
  chip: {
    flex: 1,
    backgroundColor: color.surface1,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.hairline,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    minHeight: 76,
    justifyContent: 'center',
  },
  chipTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  dot: { width: 5, height: 5, borderRadius: 3, marginRight: 6, opacity: 0.9 },
  chipName: { fontSize: 18, lineHeight: 24 },
  swap: {
    alignSelf: 'center',
    width: 40,
    height: 40,
    borderRadius: 20,
    marginHorizontal: space.xs,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surface2,
  },
  swapDisabled: { opacity: 0.35 },
  auto: { alignSelf: 'flex-start', paddingHorizontal: space.xl, paddingTop: space.xs },
});
