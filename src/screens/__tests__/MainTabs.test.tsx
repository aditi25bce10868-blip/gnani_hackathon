import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MainTabs } from '../MainTabs';

const navigation = { navigate: jest.fn(), replace: jest.fn() };

function labels(tree: ReactTestRenderer.ReactTestRenderer): string[] {
  // A Pressable shows up as several nested nodes carrying the same props.
  const all = tree.root
    .findAll(n => n.props.accessibilityRole === 'tab')
    .map(n => String(n.props.accessibilityLabel));
  return [...new Set(all)];
}

test('shows the five tabs and can open every one', async () => {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 360, height: 760 },
          insets: { top: 24, left: 0, right: 0, bottom: 16 },
        }}>
        {/* The shell only uses navigation.navigate; a stub is enough. */}
        <MainTabs {...({ navigation } as unknown as React.ComponentProps<typeof MainTabs>)} />
      </SafeAreaProvider>,
    );
  });

  expect(labels(tree)).toEqual(['Converse', 'Voice', 'Translate', 'Camera', 'Hands-free']);

  for (const label of ['Voice', 'Translate', 'Camera', 'Hands-free', 'Converse']) {
    const tab = tree.root.findAll(
      n => n.props.accessibilityRole === 'tab' && n.props.accessibilityLabel === label,
    )[0];
    await ReactTestRenderer.act(async () => {
      tab.props.onPress();
    });
    const selected = tree.root
      .findAll(n => n.props.accessibilityRole === 'tab' && n.props.accessibilityState?.selected)
      .map(n => String(n.props.accessibilityLabel));
    expect([...new Set(selected)]).toEqual([label]);
  }

  await ReactTestRenderer.act(async () => {
    tree.unmount();
  });
});
