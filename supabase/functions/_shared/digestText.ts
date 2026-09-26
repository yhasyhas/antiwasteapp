// Texte du résumé quotidien (notification push), identique aux rappels locaux de l'app
// (lib/notifications.ts, clés notifications.* des traductions) : les deux doivent rester alignés.

export type DigestLanguage = 'fr' | 'en' | 'es';

export interface DigestItem {
  id: string;
  name: string;
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

function listNames(items: DigestItem[], texts: (typeof TEXTS)[DigestLanguage]): string {
  const names = items.map((item) => item.name);
  if (names.length > MAX_NAMES) {
    const rest = names.length - MAX_NAMES;
    return fill(rest === 1 ? texts.andMoreOne : texts.andMoreOther, { items: names.slice(0, MAX_NAMES).join(', '), count: rest });
  }
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} ${texts.and} ${names[names.length - 1]}`;
}

// Même règle que generate-recipes : 1 recette pour 1 ou 2 ingrédients, 2 jusqu'à 5, sinon 3
const recipeCount = (pantrySize: number) => (pantrySize <= 2 ? 1 : pantrySize <= 5 ? 2 : 3);

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
