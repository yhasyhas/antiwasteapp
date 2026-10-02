// Bibliothèque de plats de référence (phase 9) : une source d'inspiration pour le prompt quand une cuisine
// précise est choisie, jamais une liste fermée. À chaque génération, quelques plats seulement, tirés au hasard.
// Les plats sont dans library/<région>.json : on en ajoute ou on en corrige sans toucher au code (une nouvelle
// région demande seulement une ligne d'import ci-dessous). Liste lisible : docs/bibliotheque-plats.md.

import afriqueOuest from './library/afrique-ouest.json' with { type: 'json' };
import afriqueCentrale from './library/afrique-centrale.json' with { type: 'json' };
import afriqueEst from './library/afrique-est.json' with { type: 'json' };
import afriqueAustrale from './library/afrique-australe.json' with { type: 'json' };
import oceanIndien from './library/ocean-indien.json' with { type: 'json' };
import maghreb from './library/maghreb.json' with { type: 'json' };
import asieEst from './library/asie-est.json' with { type: 'json' };
import asieSudEst from './library/asie-sud-est.json' with { type: 'json' };
import asieSud from './library/asie-sud.json' with { type: 'json' };
import mexiqueAmeriqueCentrale from './library/mexique-amerique-centrale.json' with { type: 'json' };
import caraibes from './library/caraibes.json' with { type: 'json' };
import ameriqueSud from './library/amerique-sud.json' with { type: 'json' };
import europeSud from './library/europe-sud.json' with { type: 'json' };
import levantTurquie from './library/levant-turquie.json' with { type: 'json' };
import france from './library/france.json' with { type: 'json' };

export type Moment = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface Dish {
  name: string;
  country: string;
  // Ingrédients essentiels (sans eux, ce n'est plus ce plat) et techniques clés, en français
  ingredients: string[];
  techniques: string[];
  moments: Moment[];
  // Version traditionnelle courante : "vegan", "vegetarian" ou ""
  diet: string;
}

export interface Region {
  id: string;
  name: string;
  // Cuisine de l'app qui la contient (découpage actuel : docs/cuisines-proposition.md)
  cuisine: string;
  dishes: Dish[];
}

const region = (id: string, name: string, cuisine: string, dishes: unknown): Region => ({ id, name, cuisine, dishes: dishes as Dish[] });

export const REGIONS: Region[] = [
  region('afrique-ouest', "Afrique de l'Ouest", 'african', afriqueOuest),
  region('afrique-centrale', 'Afrique centrale', 'african', afriqueCentrale),
  region('afrique-est', "Afrique de l'Est", 'african', afriqueEst),
  region('afrique-australe', 'Afrique australe', 'african', afriqueAustrale),
  region('ocean-indien', 'Océan Indien', 'african', oceanIndien),
  region('maghreb', 'Afrique du Nord (Maghreb)', 'maghreb', maghreb),
  region('asie-est', "Asie de l'Est", 'asian', asieEst),
  region('asie-sud-est', 'Asie du Sud-Est', 'asian', asieSudEst),
  region('asie-sud', 'Inde et Asie du Sud', 'asian', asieSud),
  region('mexique-amerique-centrale', 'Mexique et Amérique centrale', 'latin', mexiqueAmeriqueCentrale),
  region('caraibes', 'Caraïbes', 'latin', caraibes),
  region('amerique-sud', 'Amérique du Sud', 'latin', ameriqueSud),
  region('europe-sud', 'Europe du Sud', 'mediterranean', europeSud),
  region('levant-turquie', 'Proche-Orient et Turquie', 'mediterranean', levantTurquie),
  region('france', 'France', 'french', france),
];

export interface SampledDish extends Dish {
  region: string;
}

// Plats tirés au hasard pour une génération : du moment demandé, répartis entre les régions de la cuisine,
// de préférence compatibles avec un régime végétarien ou vegan (sinon, les autres servent quand même
// d'inspiration : le prompt demande d'adapter). Aucun plat avec « Peu importe » (cuisine libre).
// regions : régions précises (découpage de la phase 9, cuisines.ts) à la place de la cuisine de l'app
export function sampleDishes(cuisine: string, options: { mealType: string; diets?: string[]; count?: number; random?: () => number; regions?: string[]; pantry?: string[] }): SampledDish[] {
  const random = options.random ?? Math.random;
  const count = options.count ?? 5;
  const regions = options.regions ? REGIONS.filter((r) => options.regions!.includes(r.id)) : REGIONS.filter((r) => r.cuisine === cuisine);
  if (regions.length === 0) return [];
  const diets = options.diets ?? [];
  const dietOk = (dish: Dish) => diets.includes('vegan') ? dish.diet === 'vegan' : diets.includes('vegetarian') ? dish.diet !== '' : true;
  const pools = regions.map((r) => {
    const moment = r.dishes.filter((dish) => dish.moments.includes(options.mealType as Moment));
    const base = moment.length > 0 ? moment : r.dishes;
    const preferred = base.filter(dietOk);
    return { region: r.name, dishes: [...(preferred.length >= 2 ? preferred : base)] };
  });
  const picked: SampledDish[] = [];
  // Garde-manger donné : environ la moitié des exemples partage un ingrédient avec lui (sinon le modèle ignore des
  // exemples qu'il ne peut pas cuisiner), le reste est tiré au hasard comme d'habitude
  if (options.pantry && options.pantry.length > 0) {
    const pantryWords = new Set(options.pantry.flatMap(ingredientWords));
    const matching = shuffle(pools.flatMap((pool) => pool.dishes.filter((dish) => dish.ingredients.some((i) => ingredientWords(i).some((w) => pantryWords.has(w))))
      .map((dish) => ({ pool, dish }))), random);
    for (const { pool, dish } of matching) {
      if (picked.length >= Math.ceil(count / 2)) break;
      if (picked.some((p) => p.region === pool.region) && matching.some((m) => !picked.some((p) => p.region === m.pool.region))) continue;
      pool.dishes.splice(pool.dishes.indexOf(dish), 1);
      picked.push({ ...dish, region: pool.region });
    }
  }
  // Tour à tour dans les régions, dans un ordre tiré au hasard, un plat au hasard à chaque fois
  const order = shuffle(pools, random);
  for (let round = 0; picked.length < count && order.some((pool) => pool.dishes.length > 0); round++) {
    for (const pool of order) {
      if (picked.length >= count || pool.dishes.length === 0) continue;
      const [dish] = pool.dishes.splice(Math.floor(random() * pool.dishes.length), 1);
      picked.push({ ...dish, region: pool.region });
    }
  }
  return picked;
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Une ligne par plat dans le prompt : « - Mafé (Sénégal, Mali) : pâte d'arachide, poulet, tomate ; mijoter »
export const dishLine = (dish: Dish) => `- ${dish.name} (${dish.country}) : ${dish.ingredients.join(', ')} ; ${dish.techniques.join(', ')}`;

// Mots d'un ingrédient, ramenés au français pour les aliments de base (la bibliothèque est en français, le
// garde-manger dans la langue de l'utilisateur)
const BASE_WORDS: Record<string, string> = {
  chicken: 'poulet', pollo: 'poulet', rice: 'riz', arroz: 'riz', egg: 'oeuf', eggs: 'oeuf', huevo: 'oeuf', huevos: 'oeuf', oeufs: 'oeuf',
  beans: 'haricot', bean: 'haricot', frijoles: 'haricot', frijol: 'haricot', haricots: 'haricot', corn: 'mais', maiz: 'mais',
  tomato: 'tomate', tomatoes: 'tomate', tomates: 'tomate', potato: 'pomme', potatoes: 'pomme', papa: 'pomme', papas: 'pomme', patata: 'pomme', patatas: 'pomme',
  fish: 'poisson', pescado: 'poisson', beef: 'boeuf', res: 'boeuf', peanut: 'arachide', peanuts: 'arachide', mani: 'arachide', cacahuete: 'arachide',
  lentil: 'lentille', lentils: 'lentille', lentejas: 'lentille', lentilles: 'lentille', chickpeas: 'chiche', chickpea: 'chiche', garbanzos: 'chiche', chiches: 'chiche',
  coconut: 'coco', plantain: 'plantain', plantains: 'plantain', platano: 'plantain', cabbage: 'chou', col: 'chou', onion: 'oignon', onions: 'oignon', cebolla: 'oignon', oignons: 'oignon',
  spinach: 'epinard', espinacas: 'epinard', epinards: 'epinard', eggplant: 'aubergine', berenjena: 'aubergine', aubergines: 'aubergine', lamb: 'agneau', cordero: 'agneau',
  pork: 'porc', cerdo: 'porc', shrimp: 'crevette', prawns: 'crevette', gambas: 'crevette', camarones: 'crevette', crevettes: 'crevette', noodles: 'nouille', fideos: 'nouille', nouilles: 'nouille',
  avocado: 'avocat', aguacate: 'avocat', cheese: 'fromage', queso: 'fromage', broccoli: 'brocoli', carrot: 'carotte', carrots: 'carotte', zanahoria: 'carotte', zanahorias: 'carotte', carottes: 'carotte',
  bread: 'pain', pan: 'pain', tortillas: 'tortilla', semolina: 'semoule', yogurt: 'yaourt', yogur: 'yaourt', milk: 'lait', leche: 'lait', cassava: 'manioc', yuca: 'manioc',
};
const IGNORED = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'ou', 'et', 'en', 'au', 'aux', 'of', 'and', 'the', 'y', 'con', 'el', 'sec', 'secs', 'frais', 'fresh', 'huile', 'sel', 'eau']);
function ingredientWords(text: string): string[] {
  return text.toLowerCase().replace(/œ/g, 'oe').normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z]+/)
    .filter((w) => w.length >= 3 && !IGNORED.has(w)).map((w) => BASE_WORDS[w] ?? w.replace(/s$/, ''));
}
