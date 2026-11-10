// Surface — a translucent card used to group settings rows or content
// sections. Just a styled View; here so screens stop hand-rolling the same
// border + radius + bg combo.

import React from 'react';
import { StyleSheet, View, type ViewProps, type ViewStyle } from 'react-native';
import { color, radius, space } from '../theme';

interface SurfaceProps extends ViewProps {
  readonly variant?: 'plain' | 'inset';
  readonly style?: ViewStyle;
}

export function Surface({
  variant = 'plain',
  style,
  children,
  ...rest
}: SurfaceProps): React.JSX.Element {
  return (
    <View
      {...rest}
      style={[
        styles.base,
        variant === 'inset' && styles.inset,
        style,
      ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: color.bgSurface,
    borderRadius: radius.md, // 12px for panels
    borderWidth: 1,
    borderColor: color.border,
    padding: space.md,
  },
  inset: {
    backgroundColor: color.bgElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
  },
});
