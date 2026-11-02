import { Platform, useColorScheme, type ViewStyle } from 'react-native';

// Studium design system.
// Palette: Slate neutrals, Indigo as the brand ink, deep blue surfaces at night, and an amber highlighter as the
// single bold accent ("what needs attention now"). Token names are stable: screens refer to roles, not hues.
// Contrast: text/textMuted on bg and surface ≥ 4.5:1, ink on inkSoft ≥ 4.5:1 in both themes.

const light = {
  bg: '#F8FAFC', // slate-50
  surface: '#FFFFFF',
  surfaceAlt: '#F1F5F9', // slate-100
  text: '#0F172A', // slate-900
  textMuted: '#475569', // slate-600
  border: '#E2E8F0', // slate-200
  ink: '#4338CA', // indigo-700
  inkSoft: '#E0E7FF', // indigo-100
  onInk: '#FFFFFF',
  highlight: '#FCD34D', // amber-300
  onHighlight: '#1C1917',
  success: '#047857', // emerald-700
  successSoft: '#D1FAE5',
  danger: '#B91C1C', // red-700
  dangerSoft: '#FEE2E2',
  track: '#E2E8F0',
  /** Shadow colour of raised surfaces. */
  shadow: '#0F172A',
};

const dark: typeof light = {
  bg: '#0B1120', // deep blue night
  surface: '#111A2E',
  surfaceAlt: '#1A2540',
  text: '#E2E8F0', // slate-200
  textMuted: '#94A3B8', // slate-400
  border: '#24304A',
  ink: '#A5B4FC', // indigo-300
  inkSoft: '#262F5E',
  onInk: '#0B1120',
  highlight: '#FBBF24', // amber-400
  onHighlight: '#1C1917',
  success: '#6EE7B7',
  successSoft: '#0F3A2E',
  danger: '#FCA5A5',
  dangerSoft: '#3F1D24',
  track: '#24304A',
  shadow: '#000000',
};

export type Palette = typeof light;

export const fonts = {
  ui: 'Figtree_400Regular',
  uiMedium: 'Figtree_500Medium',
  uiBold: 'Figtree_700Bold',
  read: 'Literata_400Regular',
  readBold: 'Literata_600SemiBold',
};

// Type scale: sizes and line heights on the 4 px grid (line heights are multiples of 4).
export const type = {
  display: { fontFamily: fonts.uiBold, fontSize: 32, lineHeight: 40, letterSpacing: -0.6 },
  title: { fontFamily: fonts.uiBold, fontSize: 24, lineHeight: 32, letterSpacing: -0.3 },
  heading: { fontFamily: fonts.uiBold, fontSize: 18, lineHeight: 24, letterSpacing: -0.1 },
  body: { fontFamily: fonts.ui, fontSize: 16, lineHeight: 24 },
  bodyStrong: { fontFamily: fonts.uiMedium, fontSize: 16, lineHeight: 24 },
  small: { fontFamily: fonts.ui, fontSize: 14, lineHeight: 20 },
  smallStrong: { fontFamily: fonts.uiMedium, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: fonts.ui, fontSize: 12, lineHeight: 16, letterSpacing: 0.1 },
  reading: { fontFamily: fonts.read, fontSize: 17, lineHeight: 28 },
  readingHeading: { fontFamily: fonts.readBold, fontSize: 19, lineHeight: 28 },
} as const;

/** Spacing on a 4 px grid: every margin, padding and gap uses one of these. */
export const space = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
export const radius = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 } as const;

/** Minimum touch target (Material: 48 dp). */
export const touch = { min: 48 } as const;

/** Soft, low elevations: borders do the separation, shadows only lift. */
export function elevation(c: Palette, level: 0 | 1 | 2 = 1): ViewStyle {
  if (level === 0) return {};
  return Platform.select<ViewStyle>({
    android: { elevation: level === 1 ? 1 : 4, shadowColor: c.shadow },
    default: {
      shadowColor: c.shadow,
      shadowOpacity: level === 1 ? 0.06 : 0.1,
      shadowRadius: level === 1 ? 8 : 16,
      shadowOffset: { width: 0, height: level === 1 ? 2 : 6 },
    },
  });
}

/** Light or dark following the system setting (app.config: userInterfaceStyle "automatic"). */
export function usePalette(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}

export const palettes = { light, dark };
