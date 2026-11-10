// BharatConnect design tokens — Calm Dark Theme.
// Text-first translation app design system.
// Readability matters more than decoration. Flat colors only.

import { Platform } from 'react-native';

// ── Color System ─────────────────────────────────────────────────────────────

export const color = {
  // ── Backgrounds ─────────────────────────────────────────────────────────────
  bg:              '#1B1931', // --bg-base: Page background
  bgBase:          '#1B1931',
  bgSurface:       '#221F3A', // --bg-surface: cards, input and output panels
  bgElevated:      '#2B2547', // --bg-elevated: dropdowns, language picker, chips, hover

  // Surface aliases for backward compatibility
  surface1:        '#221F3A', // panels / cards
  surface2:        '#2B2547', // elevated elements / chips
  surface3:        '#2B2547', // hover / pressed

  // ── Borders ─────────────────────────────────────────────────────────────────
  border:          'rgba(233, 188, 185, 0.10)', // --border: 1px on panels
  borderStrong:    'rgba(233, 188, 185, 0.22)', // --border-strong: outlined/ghost buttons
  hairline:        'rgba(233, 188, 185, 0.10)',
  hairlineStrong:  'rgba(233, 188, 185, 0.22)',
  focusRing:       'rgba(237, 158, 89, 0.45)',  // --focus-ring: inputs focus ring
  discBorder:      'rgba(233, 188, 185, 0.22)',
  discTick:        'rgba(233, 188, 185, 0.45)',

  // ── Text / Foreground ───────────────────────────────────────────────────────
  fg:              '#F2E6E4', // --text-primary: translated output, headings
  textPrimary:     '#F2E6E4',
  fgMuted:         '#C9B8BE', // --text-secondary: source text, body
  textSecondary:   '#C9B8BE',
  fgFaint:         '#8E8499', // --text-muted: placeholders, hints, captions
  fgGhost:         '#8E8499', // --text-muted
  textMuted:       '#8E8499',
  fgWhisper:       'rgba(142, 132, 153, 0.4)',
  fgInk:           '#FFFFFF', // --text-on-primary: text on primary button
  textOnPrimary:   '#FFFFFF',

  // ── Brand / Actions ─────────────────────────────────────────────────────────
  primary:         '#A34054', // --primary: Translate button ONLY
  primaryHover:    '#B84B60', // --primary-hover
  accent:          '#ED9E59', // --accent: tiny touches: focus ring, active language, caret
  accentSoft:      '#E9BCB9', // --accent-soft: icons, small labels

  // Accents mapped for compatibility across components
  accentA:         '#ED9E59', // active indicator / touch
  accentASoft:     'rgba(237, 158, 89, 0.16)',
  accentARing:     'rgba(237, 158, 89, 0.45)',
  accentAGlow:     'rgba(237, 158, 89, 0.14)',
  accentAWhisper:  'rgba(237, 158, 89, 0.05)',

  accentB:         '#E9BCB9', // soft accent
  accentBSoft:     'rgba(233, 188, 185, 0.16)',
  accentBRing:     'rgba(233, 188, 185, 0.45)',
  accentBGlow:     'rgba(233, 188, 185, 0.14)',
  accentBWhisper:  'rgba(233, 188, 185, 0.05)',

  // ── Status ──────────────────────────────────────────────────────────────────
  ok:              '#7BC8A4', // --success
  success:         '#7BC8A4',
  okBorder:        'rgba(123, 200, 164, 0.35)',
  okSoft:          'rgba(123, 200, 164, 0.12)',

  warn:            '#ED9E59', // --warning
  warning:         '#ED9E59',

  error:           '#E4576B', // --danger
  danger:          '#E4576B',
  errorSoft:       'rgba(228, 87, 107, 0.16)',
  errorBorder:     'rgba(228, 87, 107, 0.32)',
} as const;

// ── Spacing ──────────────────────────────────────────────────────────────────

export const space = {
  xxs: 4,
  xs:  8,
  sm:  12,
  md:  16,
  lg:  20,
  xl:  24,
  xxl: 32,
  xxxl: 40,
  huge: 56,
  giant: 72,
} as const;

// ── Radii ────────────────────────────────────────────────────────────────────
// Corners 12px for panels, pill shape only for chips and the main button.

export const radius = {
  xs:   6,
  sm:   8,
  md:   12,
  lg:   12, // 12px for panels
  xl:   12,
  pill: 999, // chips and main button
} as const;

// ── Typography ───────────────────────────────────────────────────────────────

const sansFamily: string | undefined = Platform.select({
  ios: undefined,           // SF Pro
  android: 'sans-serif',    // Roboto
  default: undefined,
});

// System serif. iOS resolves to New York; Android resolves to Noto Serif.
// Both are humanist, both ship by default — no asset bundling, no risk.
const serifFamily: string = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  default: 'serif',
});

// Mono retained for the in-app log viewer (where character alignment matters).
// Everywhere else the chrome moved to serif italic.
const monoFamily: string = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'monospace',
});

export const font = {
  sansFamily,
  serifFamily,
  monoFamily,

  // Display — the big translation surface. Lighter weight, generous
  // line-height, negative tracking for editorial feel.
  display: {
    fontFamily: sansFamily,
    fontSize: 30,
    lineHeight: 38,
    fontWeight: '300' as const,
    letterSpacing: -0.4,
  },
  displayLarge: {
    fontFamily: sansFamily,
    fontSize: 36,
    lineHeight: 44,
    fontWeight: '300' as const,
    letterSpacing: -0.7,
  },
  displayHuge: {
    fontFamily: sansFamily,
    fontSize: 48,
    lineHeight: 56,
    fontWeight: '200' as const,
    letterSpacing: -1.0,
  },
  // Hero — the main translated text in conversation. Even more breathing.
  displayHero: {
    fontFamily: sansFamily,
    fontSize: 34,
    lineHeight: 42,
    fontWeight: '300' as const,
    letterSpacing: -0.6,
  },
  // Compact display — the hero voice for LONG translations. A minute of
  // speech at hero size turns the half into a wall; stepping down keeps a
  // long reading glanceable without leaving the display family.
  displayCompact: {
    fontFamily: sansFamily,
    fontSize: 22,
    lineHeight: 30,
    fontWeight: '300' as const,
    letterSpacing: -0.3,
  },
  // Editorial hero — used for setup-screen headlines and chrome-y display
  // text. Serif italic, big, generous line-height. The literary voice of
  // Dusk's setup surfaces (LanguagePair, eventually Settings hero, etc).
  serifHero: {
    fontFamily: serifFamily,
    fontStyle: 'italic' as const,
    fontSize: 30,
    lineHeight: 38,
    fontWeight: '400' as const,
    letterSpacing: -0.4,
  },

  // Body
  body: {
    fontFamily: sansFamily,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400' as const,
  },
  bodySmall: {
    fontFamily: sansFamily,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '400' as const,
  },

  // Caption — small UI labels, micro-tags
  caption: {
    fontFamily: sansFamily,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '500' as const,
    letterSpacing: 0.8,
  },

  // Serif italic — Dusk's chrome voice. Used for language codes, source-line
  // labels, microcopy, edge chrome, version tag. Softens the technical edge.
  serif: {
    fontFamily: serifFamily,
    fontStyle: 'italic' as const,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400' as const,
    letterSpacing: 0.2,
  },
  serifSmall: {
    fontFamily: serifFamily,
    fontStyle: 'italic' as const,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '400' as const,
    letterSpacing: 0.6,
  },
  serifTiny: {
    fontFamily: serifFamily,
    fontStyle: 'italic' as const,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '400' as const,
    letterSpacing: 1.4,
  },

  // Mono — retained for the diagnostics log viewer (character alignment
  // matters there). Avoid in conversation chrome — Dusk speaks serif.
  mono: {
    fontFamily: monoFamily,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '400' as const,
    letterSpacing: 0.4,
  },
  monoSmall: {
    fontFamily: monoFamily,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '400' as const,
    letterSpacing: 0.5,
  },

  // Button label
  button: {
    fontFamily: sansFamily,
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '500' as const,
    letterSpacing: 0.2,
  },
} as const;

// ── Motion ───────────────────────────────────────────────────────────────────
// Minimal animations: 150ms fades, no bouncing or glow effects.

export const motion = {
  springSnappy:   { damping: 30, stiffness: 300, mass: 1 },
  springSoft:     { damping: 30, stiffness: 250, mass: 1 },
  springSubtle:   { damping: 35, stiffness: 320, mass: 1 },
  springBouncy:   { damping: 30, stiffness: 250, mass: 1 },

  fast:    150,
  normal:  150,
  slow:    250,
  glacial: 400,
} as const;

// ── Speaker accent helper ────────────────────────────────────────────────────

export type SpeakerSide = 'A' | 'B';

export const accentFor = (side: SpeakerSide) => ({
  base:    side === 'A' ? color.accentA    : color.accentB,
  soft:    side === 'A' ? color.accentASoft: color.accentBSoft,
  ring:    side === 'A' ? color.accentARing: color.accentBRing,
  glow:    side === 'A' ? color.accentAGlow: color.accentBGlow,
  whisper: side === 'A' ? color.accentAWhisper: color.accentBWhisper,
});
