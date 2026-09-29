import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Ellipse, G, Line, Path, Rect } from 'react-native-svg';
import { colors, sizes, spacing, typography } from '@/constants/theme';

// Illustrations de l'app (style des maquettes : formes douces vert clair, traits verts, feuilles citron vert)

const ink = colors.illustration.line;
const leaf = colors.illustration.leaf;
const shape = colors.illustration.shape;
const surface = colors.surface;
const STROKE = 3;

// Petite feuille (réutilisée dans les dessins) : pointe en haut à droite
function Leaf({ x, y, scale = 1, rotate = 0 }: { x: number; y: number; scale?: number; rotate?: number }) {
  return (
    <G transform={`translate(${x} ${y}) rotate(${rotate}) scale(${scale})`}>
      <Path d="M0 0 C 6 -16, 22 -20, 30 -22 C 28 -12, 22 4, 4 4 Z" fill={leaf} />
      <Path d="M2 2 L 24 -16" stroke={ink} strokeWidth={1.5} strokeLinecap="round" />
    </G>
  );
}

// Image de remplacement d'une recette sans photo : assiette, couverts et feuilles, avec un libellé
export function RecipePlaceholder({ label, compact = false, style }: { label?: string; compact?: boolean; style?: StyleProp<ViewStyle> }) {
  const size = compact ? sizes.thumbnail * 0.8 : sizes.illustration;
  return (
    <View style={[styles.placeholder, style]}>
      <Svg width={size} height={size * 0.62} viewBox="0 0 200 124">
        <Leaf x={34} y={96} scale={1.1} rotate={-20} />
        <Leaf x={150} y={40} scale={0.9} rotate={40} />
        <Ellipse cx={100} cy={70} rx={50} ry={46} fill={shape} />
        <Circle cx={100} cy={70} r={32} fill={surface} stroke={ink} strokeWidth={STROKE} />
        <Circle cx={100} cy={70} r={20} fill={colors.accentSoft} />
        {/* Fourchette */}
        <G stroke={ink} strokeWidth={STROKE} strokeLinecap="round">
          <Line x1={52} y1={40} x2={52} y2={104} />
          <Line x1={45} y1={40} x2={45} y2={56} />
          <Line x1={59} y1={40} x2={59} y2={56} />
          <Path d="M45 56 Q 52 64 59 56" fill="none" />
        </G>
        {/* Couteau */}
        <G stroke={ink} strokeWidth={STROKE} strokeLinecap="round" fill="none">
          <Path d="M148 104 L 148 40 Q 158 50 156 72 L 148 74" />
        </G>
      </Svg>
      {label ? <Text style={[styles.placeholderLabel, compact && styles.placeholderLabelCompact]}>{label}</Text> : null}
    </View>
  );
}

// Garde-manger vide : bocal et panier avec des feuilles
function PantryDrawing() {
  return (
    <Svg width={sizes.illustration} height={sizes.illustration} viewBox="0 0 160 160">
      <Circle cx={80} cy={84} r={64} fill={shape} />
      <Rect x={50} y={52} width={60} height={78} rx={16} fill={surface} stroke={ink} strokeWidth={STROKE} />
      <Rect x={44} y={40} width={72} height={16} rx={8} fill={colors.accent} stroke={ink} strokeWidth={STROKE} />
      <Line x1={62} y1={80} x2={98} y2={80} stroke={ink} strokeWidth={STROKE} strokeLinecap="round" strokeDasharray="2 8" />
      <Line x1={62} y1={100} x2={88} y2={100} stroke={ink} strokeWidth={STROKE} strokeLinecap="round" strokeDasharray="2 8" />
      <Leaf x={104} y={52} scale={1.2} rotate={-10} />
      <Leaf x={30} y={118} scale={0.9} rotate={-40} />
    </Svg>
  );
}

// Aucune recette : marmite qui fume
function RecipesDrawing() {
  return (
    <Svg width={sizes.illustration} height={sizes.illustration} viewBox="0 0 160 160">
      <Circle cx={80} cy={84} r={64} fill={shape} />
      <Path d="M40 80 H120 V110 Q120 128 102 128 H58 Q40 128 40 110 Z" fill={surface} stroke={ink} strokeWidth={STROKE} strokeLinejoin="round" />
      <Rect x={34} y={72} width={92} height={12} rx={6} fill={colors.accent} stroke={ink} strokeWidth={STROKE} />
      <Line x1={28} y1={94} x2={40} y2={94} stroke={ink} strokeWidth={STROKE} strokeLinecap="round" />
      <Line x1={120} y1={94} x2={132} y2={94} stroke={ink} strokeWidth={STROKE} strokeLinecap="round" />
      <G stroke={ink} strokeWidth={STROKE} strokeLinecap="round" fill="none">
        <Path d="M66 60 Q 60 50 66 40 Q 72 30 66 22" />
        <Path d="M84 60 Q 78 50 84 40 Q 90 30 84 22" />
      </G>
      <Leaf x={100} y={46} scale={1} rotate={-20} />
    </Svg>
  );
}

// Courses vides : sac avec une feuille qui dépasse
function ShoppingDrawing() {
  return (
    <Svg width={sizes.illustration} height={sizes.illustration} viewBox="0 0 160 160">
      <Circle cx={80} cy={84} r={64} fill={shape} />
      <Leaf x={72} y={62} scale={1.3} rotate={-60} />
      <Path d="M46 62 H114 L108 128 Q107 134 100 134 H60 Q53 134 52 128 Z" fill={surface} stroke={ink} strokeWidth={STROKE} strokeLinejoin="round" />
      <Path d="M64 70 V58 Q64 42 80 42 Q96 42 96 58 V70" fill="none" stroke={ink} strokeWidth={STROKE} strokeLinecap="round" />
      <Circle cx={80} cy={100} r={10} fill={colors.accent} />
    </Svg>
  );
}

const DRAWINGS = { pantry: PantryDrawing, recipes: RecipesDrawing, shopping: ShoppingDrawing } as const;

// État vide illustré : dessin, titre, texte et action éventuelle
export function EmptyState({ kind, title, text, action }: { kind: keyof typeof DRAWINGS; title: string; text?: string; action?: React.ReactNode }) {
  const Drawing = DRAWINGS[kind];
  return (
    <View style={styles.empty}>
      <Drawing />
      <Text style={styles.emptyTitle}>{title}</Text>
      {text ? <Text style={styles.emptyText}>{text}</Text> : null}
      {action ? <View style={styles.emptyAction}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: colors.illustration.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  placeholderLabel: {
    ...typography.secondaryStrong,
    color: colors.primary,
  },
  placeholderLabelCompact: {
    ...typography.badge,
    color: colors.primary,
  },
  empty: {
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.xxxl,
    gap: spacing.md,
  },
  emptyTitle: {
    ...typography.title3,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  emptyAction: {
    alignSelf: 'stretch',
    marginTop: spacing.sm,
  },
});
