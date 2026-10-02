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
export function sampleDishes(cuisine: string, options: { mealType: string; diets?: string[]; count?: number; random?: () => number; regions?: string[] }): SampledDish[] {
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
  // Tour à tour dans les régions, dans un ordre tiré au hasard, un plat au hasard à chaque fois
  const order = shuffle(pools, random);
  const picked: SampledDish[] = [];
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
