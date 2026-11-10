// Flat page backdrop — calm dark theme.
// Rule: No gradients anywhere. Flat colors only. Page background --bg-base (#1B1931).

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { color } from '../theme';

export function DuskBackdrop(): React.JSX.Element {
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: color.bg }]}
    />
  );
}
