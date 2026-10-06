// Couleurs du système de design (constants/theme.ts, qui les réexporte) : fichier sans dépendance, lu aussi par le
// test des contrastes (lib/contrast.test.ts).

// ── Couleurs ──────────────────────────────────────────────────────────────────────────────────────

// Grandes familles d'aliments : teinte douce de la pastille d'icône du garde-manger
export type FoodFamily = 'plant' | 'protein' | 'cold' | 'grocery' | 'seasoning' | 'dish' | 'other';

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
  // Pastilles des aliments par famille : fond doux, icône foncée (contraste suffisant sur le fond)
  foodFamilies: Record<FoodFamily, { background: string; icon: string }>;
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
  foodFamilies: {
    // Fruits, légumes, légumineuses : le vert de l'app
    plant: { background: '#E1EEDF', icon: '#2E6A4A' },
    // Viandes, poissons, œufs : terre cuite
    protein: { background: '#F7E3DA', icon: '#94452A' },
    // Produits laitiers, surgelés, boissons : bleu frais
    cold: { background: '#E0ECF3', icon: '#2D5C7C' },
    // Céréales, boulangerie, en-cas : blé
    grocery: { background: '#F5EBD2', icon: '#7A5712' },
    // Condiments, épices : citron vert
    seasoning: { background: '#EEF5D3', icon: '#4D6814' },
    // Restes de plats : citron vert, comme le badge « Reste »
    dish: { background: '#EEF5D3', icon: '#2E6A4A' },
    // Catégorie inconnue : la feuille d'avant
    other: { background: '#E1EEDF', icon: '#2E6A4A' },
  },
  transparent: 'transparent',
};

// Thème sombre : préparé, pas encore activé (valeurs à définir ; reprend le thème clair en attendant)
export const darkColors: ThemeColors = { ...lightColors };
