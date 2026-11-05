// Tab bar glyphs — drawn with react-native-svg (already a dependency) so no
// icon font or new native module is needed.

import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type TabIconName = 'converse' | 'voice' | 'translate' | 'camera' | 'handsfree';

interface Props {
  readonly name: TabIconName;
  readonly color: string;
  readonly size?: number;
}

export function TabIcon({ name, color, size = 24 }: Props): React.JSX.Element {
  const stroke = {
    stroke: color,
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'converse' && (
        <>
          <Rect x={9} y={3} width={6} height={11} rx={3} {...stroke} />
          <Path d="M5.5 11a6.5 6.5 0 0 0 13 0" {...stroke} />
          <Path d="M12 17.5L12 21" {...stroke} />
        </>
      )}
      {name === 'voice' && (
        <>
          <Path d="M4 10L4 14" {...stroke} />
          <Path d="M8 7L8 17" {...stroke} />
          <Path d="M12 4L12 20" {...stroke} />
          <Path d="M16 8L16 16" {...stroke} />
          <Path d="M20 10.5L20 13.5" {...stroke} />
        </>
      )}
      {name === 'translate' && (
        <>
          <Path d="M3.5 6h8M7.5 4v2M5 6c.4 3.2 2.6 5.6 5.5 6.8M10 6c-.6 3.2-2.8 5.6-5.8 6.8" {...stroke} />
          <Path d="M12.5 20l3.8-9 3.8 9M13.9 16.8h4.8" {...stroke} />
        </>
      )}
      {name === 'camera' && (
        <>
          <Path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.2l1.3-2h6l1.3 2h2.2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z" {...stroke} />
          <Circle cx={12} cy={13} r={3.3} {...stroke} />
        </>
      )}
      {name === 'handsfree' && (
        <>
          <Circle cx={12} cy={12} r={2.2} fill={color} />
          <Path d="M7.6 7.6a6.2 6.2 0 0 0 0 8.8M16.4 7.6a6.2 6.2 0 0 1 0 8.8" {...stroke} />
          <Path d="M4.6 4.6a10.4 10.4 0 0 0 0 14.8M19.4 4.6a10.4 10.4 0 0 1 0 14.8" {...stroke} />
        </>
      )}
    </Svg>
  );
}

export function MicGlyph({ color, size = 30 }: { readonly color: string; readonly size?: number }): React.JSX.Element {
  return <TabIcon name="converse" color={color} size={size} />;
}
