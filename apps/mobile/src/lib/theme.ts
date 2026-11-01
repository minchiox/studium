import { useColorScheme } from 'react-native';

// "Quaderno" palette: ink on cool paper, with a highlighter as the single bold accent.
const light = {
  bg: '#F5F7FB', // carta
  surface: '#FFFFFF',
  surfaceAlt: '#EBEEF6',
  text: '#262B36', // grafite
  textMuted: '#5D6472',
  border: '#DCE1EC',
  ink: '#1F3A8A', // inchiostro
  inkSoft: '#DDE5FA',
  onInk: '#FFFFFF',
  highlight: '#FFE066', // evidenziatore
  onHighlight: '#262B36',
  success: '#2E7D5B',
  successSoft: '#DCEFE6',
  danger: '#B42318',
  dangerSoft: '#FBE3E1',
  track: '#E2E6F0',
};

const dark: typeof light = {
  bg: '#0F1422', // notte
  surface: '#182033',
  surfaceAlt: '#212A40',
  text: '#E7EAF2',
  textMuted: '#A4ABBB',
  border: '#2A3450',
  ink: '#9DB2FF',
  inkSoft: '#26325A',
  onInk: '#0F1422',
  highlight: '#F2D04B',
  onHighlight: '#1A1A12',
  success: '#6FCF9F',
  successSoft: '#17362A',
  danger: '#FF8A7F',
  dangerSoft: '#3D1C1C',
  track: '#2A3450',
};

export type Palette = typeof light;

export const fonts = {
  ui: 'Figtree_400Regular',
  uiMedium: 'Figtree_500Medium',
  uiBold: 'Figtree_700Bold',
  read: 'Literata_400Regular',
  readBold: 'Literata_600SemiBold',
};

// Type scale on a 1.2 ratio from 16 px body text.
export const type = {
  display: { fontFamily: fonts.uiBold, fontSize: 34, lineHeight: 40, letterSpacing: -0.6 },
  title: { fontFamily: fonts.uiBold, fontSize: 23, lineHeight: 29, letterSpacing: -0.3 },
  heading: { fontFamily: fonts.uiBold, fontSize: 19, lineHeight: 25 },
  body: { fontFamily: fonts.ui, fontSize: 16, lineHeight: 23 },
  bodyStrong: { fontFamily: fonts.uiMedium, fontSize: 16, lineHeight: 23 },
  small: { fontFamily: fonts.ui, fontSize: 14, lineHeight: 20 },
  smallStrong: { fontFamily: fonts.uiMedium, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: fonts.ui, fontSize: 12.5, lineHeight: 17 },
  reading: { fontFamily: fonts.read, fontSize: 17, lineHeight: 28 },
  readingHeading: { fontFamily: fonts.readBold, fontSize: 19, lineHeight: 27 },
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 6, md: 10, lg: 16, pill: 999 } as const;

export function usePalette(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}

export const palettes = { light, dark };
