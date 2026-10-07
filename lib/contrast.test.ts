// Contrastes des couleurs du thème (constants/theme.ts), selon les seuils WCAG AA : 4,5 pour le texte courant,
// 3 pour les icônes, les grands textes et les éléments d'interface. Lancement : deno test --no-config --allow-env supabase/functions/ lib/
import { assert } from 'jsr:@std/assert@1';
import { lightColors as c } from '../constants/palette.ts';

type Rgb = [number, number, number];

function parse(color: string, over?: Rgb): Rgb {
  const hex = color.match(/^#([0-9a-f]{6})$/i);
  if (hex) return [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16)) as Rgb;
  const rgba = color.match(/^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/);
  if (rgba && over) {
    const alpha = Number(rgba[4]);
    return [1, 2, 3].map((i, k) => Number(rgba[i]) * alpha + over[k] * (1 - alpha)) as Rgb;
  }
  throw new Error(`couleur illisible : ${color}`);
}

const luminance = ([r, g, b]: Rgb) => {
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

export function contrast(foreground: string, background: string): number {
  const back = parse(background);
  const [a, b] = [luminance(parse(foreground, back)), luminance(back)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

const TEXT = 4.5;
const LARGE = 3;

// [premier plan, fond, seuil, usage]
const PAIRS: [string, string, number, string][] = [
  [c.text, c.background, TEXT, 'texte sur le fond'],
  [c.text, c.surface, TEXT, 'texte sur une carte'],
  [c.text, c.primarySoft, TEXT, 'texte sur une carte douce, une puce'],
  [c.text, c.accentSoft, TEXT, 'texte sur fond citron vert doux'],
  [c.textSecondary, c.background, TEXT, 'texte secondaire sur le fond'],
  [c.textSecondary, c.surface, TEXT, 'texte secondaire sur une carte'],
  [c.textSecondary, c.primarySoft, TEXT, 'texte secondaire sur une carte douce'],
  [c.primary, c.background, TEXT, 'lien, bouton discret sur le fond'],
  [c.primary, c.surface, TEXT, 'lien, bouton discret sur une carte'],
  [c.primary, c.primarySoft, TEXT, 'texte vert sur une puce'],
  [c.onPrimary, c.primary, TEXT, 'bouton principal'],
  [c.onAccent, c.accent, TEXT, 'bouton citron vert'],
  [c.expired.text, c.expired.background, TEXT, 'badge « périmé »'],
  [c.expired.text, c.surface, TEXT, 'texte rouge sur une carte'],
  [c.soon.text, c.soon.background, TEXT, 'badge « bientôt »'],
  [c.ok.text, c.ok.background, TEXT, 'badge « OK »'],
  [c.toast.text, c.toast.background, TEXT, 'message temporaire'],
  [c.toast.action, c.toast.background, TEXT, 'action du message temporaire'],
  [c.onCamera, c.camera, TEXT, 'texte sur la caméra'],
  [c.onCameraMuted, c.camera, TEXT, 'texte discret sur la caméra'],
  [c.accent, c.camera, LARGE, 'cadre de visée sur la caméra'],
  ...Object.entries(c.foodFamilies).map(([family, { background, icon }]) => [icon, background, LARGE, `icône d'aliment (${family})`] as [string, string, number, string]),
];

Deno.test('contrastes du thème : seuils WCAG AA', () => {
  const failures = PAIRS.map(([fg, bg, min, use]) => ({ use, ratio: contrast(fg, bg), min })).filter((p) => p.ratio < p.min);
  assert(failures.length === 0, failures.map((f) => `${f.use} : ${f.ratio.toFixed(2)} (minimum ${f.min})`).join('\n'));
});

Deno.test('contrastes : calcul vérifié sur des valeurs connues', () => {
  assert(Math.abs(contrast('#000000', '#FFFFFF') - 21) < 0.01);
  assert(Math.abs(contrast('#777777', '#FFFFFF') - 4.48) < 0.01);
});
