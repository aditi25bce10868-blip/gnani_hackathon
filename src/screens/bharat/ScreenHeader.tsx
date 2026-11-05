import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, space } from '../../ui';

interface Props {
  readonly eyebrow: string;
  readonly title: string;
  readonly onSettings: () => void;
  /** Name of the engine behind the tab, shown quietly when it is a demo. */
  readonly engineNote?: string;
}

export function ScreenHeader({ eyebrow, title, onSettings, engineNote }: Props): React.JSX.Element {
  return (
    <View style={styles.root}>
      <View style={styles.row}>
        <Text variant="caption" tone="fgGhost" style={styles.eyebrow}>
          {eyebrow}
        </Text>
        <Pressable onPress={onSettings} hitSlop={14} accessibilityRole="button" accessibilityLabel="Settings">
          <Text variant="serif" tone="fgFaint">
            settings
          </Text>
        </Pressable>
      </View>
      <Text variant="serifHero" tone="fg" style={styles.title}>
        {title}
      </Text>
      {engineNote ? (
        <Text variant="serifSmall" tone="fgFaint" style={styles.note}>
          {engineNote}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: space.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { letterSpacing: 2.4 },
  title: { marginTop: space.xs, fontSize: 26, lineHeight: 32 },
  note: { marginTop: space.xxs },
});
