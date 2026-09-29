import type { TextStyle } from 'react-native';

// Système de design « Fraîche et naturelle » (phase 7) : seule source des couleurs, typographies,
// arrondis, espacements et tailles de l'app. Les écrans et composants n'écrivent aucune valeur en dur :
// ils lisent ces jetons.

// ── Couleurs ──────────────────────────────────────────────────────────────────────────────────────

export interface ThemeColors {
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
  primary: string;
  onPrimary: string;
  accent: string;
  onAccent: string;
  primarySoft: string;
  accentSoft: string;
  // États de péremption (et tons des badges) : texte sur fond
  expired: { text: string; background: string };
  soon: { text: string; background: string };
  ok: { text: string; background: string };
  // Voile derrière les feuilles du bas et les fenêtres
  scrim: string;
  // Fond de l'écran de scan (autour de l'aperçu de l'appareil photo)
  camera: string;
  // Texte et contrôles posés sur le fond caméra
  onCamera: string;
  onCameraMuted: string;
  cameraControl: string;
  // Illustrations (images de remplacement, états vides) : tons dérivés de la palette
  illustration: { background: string; shape: string; line: string; leaf: string };
  // Squelettes de chargement
  skeleton: string;
  // Message temporaire en bas de l'écran (« Aliment retiré · Annuler ») : fond sombre, action en citron vert
  toast: { background: string; text: string; action: string };
  transparent: string;
}

export const lightColors: ThemeColors = {
  background: '#F3F7F1',
  surface: '#FFFFFF',
  text: '#15241B',
  textSecondary: '#52645A',
  border: '#D7E3D5',
  primary: '#2E6A4A',
  onPrimary: '#FFFFFF',
  accent: '#B9D45A',
  onAccent: '#15241B',
  primarySoft: '#E1EEDF',
  accentSoft: '#EEF5D3',
  expired: { text: '#B3261E', background: '#F9E1DE' },
  soon: { text: '#8A5200', background: '#FCEFD4' },
  ok: { text: '#2E6A4A', background: '#DDEEDF' },
  scrim: 'rgba(10,18,13,0.55)',
  camera: '#1E2B23',
  onCamera: '#FFFFFF',
  onCameraMuted: 'rgba(255,255,255,0.6)',
  cameraControl: 'rgba(255,255,255,0.16)',
  illustration: { background: '#D2E4CC', shape: '#E1EEDF', line: '#2E6A4A', leaf: '#B9D45A' },
  skeleton: '#E1EEDF',
  toast: { background: '#15241B', text: '#FFFFFF', action: '#B9D45A' },
  transparent: 'transparent',
};

// Thème sombre : préparé, pas encore activé (valeurs à définir ; reprend le thème clair en attendant)
export const darkColors: ThemeColors = { ...lightColors };

// Thème actif : toujours le clair pour l'instant (le sombre sera branché plus tard)
export const colors: ThemeColors = lightColors;

// ── Typographies ──────────────────────────────────────────────────────────────────────────────────

// Noms des polices chargées au démarrage (app/_layout.tsx) ; avec une police personnalisée, la graisse
// est portée par la police elle-même (pas de fontWeight)
export const fontFamilies = {
  title: 'BricolageGrotesque_800ExtraBold',
  regular: 'Figtree_400Regular',
  medium: 'Figtree_500Medium',
  semibold: 'Figtree_600SemiBold',
  bold: 'Figtree_700Bold',
} as const;

const title = (fontSize: number): TextStyle => ({
  fontFamily: fontFamilies.title,
  fontSize,
  lineHeight: Math.round(fontSize * 1.1),
  color: colors.text,
});

const text = (fontSize: number, family: keyof typeof fontFamilies, lineHeight = 1.4): TextStyle => ({
  fontFamily: fontFamilies[family],
  fontSize,
  lineHeight: Math.round(fontSize * lineHeight),
  color: colors.text,
});

export const typography = {
  // Titres (Bricolage Grotesque 800, interligne 1,1)
  title1: title(28),
  title2: title(24),
  title3: title(22),
  // Accroche de l'écran de connexion
  hero: title(34),
  // Grand chiffre (compteur anti-gaspi)
  display: title(56),
  // Texte (Figtree)
  body: text(16, 'regular'),
  bodyMedium: text(16, 'medium'),
  bodyStrong: text(16, 'semibold'),
  button: text(16, 'bold', 1.25),
  listTitle: text(15, 'semibold', 1.3),
  cardTitle: text(17, 'bold', 1.3),
  secondary: { ...text(13, 'regular'), color: colors.textSecondary } as TextStyle,
  secondaryStrong: { ...text(13, 'semibold'), color: colors.textSecondary } as TextStyle,
  badge: text(12, 'semibold', 1.25),
  // Étiquette de groupe (« À UTILISER VITE »)
  overline: { ...text(13, 'bold', 1.25), letterSpacing: 0.8, textTransform: 'uppercase' } as TextStyle,
  // Étiquette au-dessus d'un champ
  label: text(14, 'semibold', 1.3),
  tab: text(11, 'semibold', 1.25),
} satisfies Record<string, TextStyle>;

// ── Formes, espacements, tailles ──────────────────────────────────────────────────────────────────

export const radius = {
  card: 18,
  control: 14,
  iconChip: 12,
  pill: 999,
  sheet: 26,
  // Petits éléments (case à cocher, cadre de code)
  small: 8,
} as const;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  // Marge horizontale des écrans
  screen: 20,
} as const;

export const sizes = {
  // Zone tactile minimale
  touch: 44,
  primaryButton: 54,
  button: 48,
  input: 52,
  iconChip: 40,
  iconChipLarge: 56,
  avatar: 44,
  checkbox: 26,
  icon: 20,
  iconSmall: 16,
  iconLarge: 24,
  fab: 60,
  captureButton: 76,
  sheetHandle: { width: 44, height: 5 },
  tabBar: 64,
  tabPill: { width: 56, height: 30 },
  recipeImage: 170,
  recipeHero: 260,
  thumbnail: 72,
  codeBox: 46,
  illustration: 140,
  borderWidth: 1,
  borderStrong: 2,
  // Coins du cadre de visée (scan)
  scanCorner: 40,
  scanCornerWidth: 4,
  scanFrame: 280,
  // Cadre de la vérification Turnstile (widget normal ou compact)
  captchaFrame: { normal: 80, compact: 150 },
} as const;

// Ombres légères (cartes flottantes : bouton « + », feuilles)
export const shadows = {
  floating: {
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 6,
  },
} as const;

// Durées d'animation (ms)
export const motion = {
  fast: 120,
  normal: 220,
  slow: 320,
  // Transition entre deux écrans
  screen: 260,
  // Retour visuel au toucher : échelle du bouton pressé
  pressedScale: 0.97,
  pressedOpacity: 0.85,
  // Message « Annuler » (et « Voir ») : durée d'affichage ; revient au retour dans l'app pendant undoRedisplay
  undoWindow: 10000,
  undoRedisplay: 120000,
} as const;

// Listes : apparition des cartes (décalage entre deux cartes) et réarrangement
export const listMotion = {
  stagger: 40,
  maxStaggered: 8,
} as const;

export const opacity = {
  disabled: 0.45,
} as const;

export const theme = { colors, typography, radius, spacing, sizes, shadows, motion, opacity };
export type Theme = typeof theme;
