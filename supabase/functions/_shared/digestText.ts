// Texte du résumé quotidien (notification push), identique aux rappels locaux de l'app
// (lib/notifications.ts, clés notifications.* des traductions) : les deux doivent rester alignés.

export type DigestLanguage = 'fr' | 'en' | 'es';

export interface DigestItem {
  id: string;
  name: string;
}

// Nom d'un aliment dans la langue de l'utilisateur : copie de lib/localFoodName.ts (même règle que l'app ;
// lib/localFoodName.test.ts vérifie que les deux donnent le même résultat).
//   - produit scanné par code-barres (nom de marque) ou plat cuisiné (reste) : nom enregistré ;
//   - aliment brut relié à sa fiche (food_key) : nom de la fiche dans la langue demandée ;
//   - sinon : nom saisi.
export interface NameableFood {
  name: string;
  food_key?: string | null;
  kind?: string | null;
  barcode?: string | null;
}
export type FactNames = Partial<Record<DigestLanguage, string | null>>;

export function localFoodName(item: NameableFood, factNames: FactNames | null | undefined, language: string): string {
  if (item.barcode || item.kind === 'dish' || !item.food_key) return item.name;
  const translated = factNames?.[language as DigestLanguage];
  return translated && translated.trim() !== '' ? translated : item.name;
}

const TEXTS: Record<DigestLanguage, {
  title: string;
  today: string;
  tomorrow: string;
  recipesOne: string;
  recipesOther: string;
  and: string;
  andMoreOne: string;
  andMoreOther: string;
}> = {
  fr: {
    title: 'À cuisiner vite',
    today: "Aujourd'hui : {items}.",
    tomorrow: 'Demain : {items}.',
    recipesOne: '{count} recette t’attend.',
    recipesOther: '{count} recettes t’attendent.',
    and: 'et',
    andMoreOne: '{items} et {count} autre',
    andMoreOther: '{items} et {count} autres',
  },
  en: {
    title: 'Use it up soon',
    today: 'Today: {items}.',
    tomorrow: 'Tomorrow: {items}.',
    recipesOne: '{count} recipe is waiting for you.',
    recipesOther: '{count} recipes are waiting for you.',
    and: 'and',
    andMoreOne: '{items} and {count} more',
    andMoreOther: '{items} and {count} more',
  },
  es: {
    title: '¡Úsalo pronto!',
    today: 'Hoy: {items}.',
    tomorrow: 'Mañana: {items}.',
    recipesOne: '{count} receta te espera.',
    recipesOther: '{count} recetas te esperan.',
    and: 'y',
    andMoreOne: '{items} y {count} más',
    andMoreOther: '{items} y {count} más',
  },
};

// Au plus ce nombre de noms, puis « et N autres » (comme l'app)
const MAX_NAMES = 3;

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ''));

// Plusieurs lots d'un même aliment le même jour : son nom une seule fois (comme l'app)
function uniqueNames(items: DigestItem[]): string[] {
  const seen = new Set<string>();
  return items.map((item) => item.name).filter((name) => {
    const key = name.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function listNames(items: DigestItem[], texts: (typeof TEXTS)[DigestLanguage]): string {
  const names = uniqueNames(items);
  if (names.length > MAX_NAMES) {
    const rest = names.length - MAX_NAMES;
    return fill(rest === 1 ? texts.andMoreOne : texts.andMoreOther, { items: names.slice(0, MAX_NAMES).join(', '), count: rest });
  }
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} ${texts.and} ${names[names.length - 1]}`;
}

// Même règle que generate-recipes : 2 recettes pour 1 ou 2 aliments, 3 à partir de 3
const recipeCount = (pantrySize: number): number => (pantrySize <= 2 ? 2 : 3);

export function digestContent(today: DigestItem[], tomorrow: DigestItem[], pantrySize: number, language: string) {
  const texts = TEXTS[(language in TEXTS ? language : 'fr') as DigestLanguage];
  const parts: string[] = [];
  if (today.length > 0) parts.push(fill(texts.today, { items: listNames(today, texts) }));
  if (tomorrow.length > 0) parts.push(fill(texts.tomorrow, { items: listNames(tomorrow, texts) }));
  const count = recipeCount(pantrySize);
  parts.push(fill(count === 1 ? texts.recipesOne : texts.recipesOther, { count }));
  return {
    title: texts.title,
    body: parts.join(' '),
    // Identifiants présélectionnés dans l'écran de génération quand on touche la notification
    data: { priority: [...today, ...tomorrow].map((item) => item.id).join(',') },
  };
}
