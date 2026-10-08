// Nom d'un aliment dans une langue, sans dépendance à React Native (testé par localFoodName.test.ts). Même règle
// partout : affichage de l'app (lib/foodNames.ts), rappels locaux (lib/notifications.ts) et résumé quotidien du
// serveur (supabase/functions/_shared/digestText.ts, copie alignée par le test).
//   - produit scanné par code-barres (nom de marque) ou plat cuisiné (reste) : nom enregistré ;
//   - aliment brut relié à sa fiche (food_key) : nom de la fiche dans la langue demandée ;
//   - sinon (pas de fiche, fiche sans cette langue) : nom saisi.

export type FoodLanguage = 'fr' | 'en' | 'es';
export type FactNames = Partial<Record<FoodLanguage, string | null>>;

export interface NameableFood {
  name: string;
  food_key?: string | null;
  kind?: string | null;
  barcode?: string | null;
}

export function localFoodName(item: NameableFood, factNames: FactNames | null | undefined, language: string): string {
  if (item.barcode || item.kind === 'dish' || !item.food_key) return item.name;
  const translated = factNames?.[language as FoodLanguage];
  return translated && translated.trim() !== '' ? translated : item.name;
}
