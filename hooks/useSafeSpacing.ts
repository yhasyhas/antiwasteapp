import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Marges du système : l'app s'affiche d'un bord à l'autre de l'écran (Android 15 et le build de
// développement), sous la barre d'état en haut et sous la barre de navigation en bas (trois boutons ou
// barre de gestes). Tout élément collé à un bord ajoute la marge du système à son espacement.
export function useSafeSpacing() {
  const insets = useSafeAreaInsets();
  return {
    insets,
    // En-tête collé en haut de l'écran
    top: (extra = 16) => ({ paddingTop: insets.top + extra }),
    // Bouton, pied de page ou feuille collé en bas de l'écran
    bottom: (extra = 16) => ({ paddingBottom: insets.bottom + extra }),
  };
}
