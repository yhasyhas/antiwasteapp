import type { TextStyle } from 'react-native';

// Système de design « Fraîche et naturelle » (phase 7) : seule source des couleurs, typographies,
// arrondis, espacements et tailles de l'app. Les écrans et composants n'écrivent aucune valeur en dur :
// ils lisent ces jetons.

// ── Couleurs ──────────────────────────────────────────────────────────────────────────────────────

// Palette et types dans constants/palette.ts (testés : lib/contrast.test.ts)
import { lightColors, type ThemeColors } from './palette';
export { darkColors, lightColors, type FoodFamily, type ThemeColors } from './palette';

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
  // Bouton rond du Scanner au centre de la barre d'onglets
  tabFeatured: 58,
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
