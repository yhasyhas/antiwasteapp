// Grille d'évaluation des recettes (phase 9), notée par un modèle juge, sans appel réseau ici.
// Chaque critère est noté de 1 (mauvais) à 5 (parfait), avec les problèmes concrets relevés.

export const CRITERIA = ['quantities', 'cooking_cues', 'order', 'ingredients_used', 'authenticity', 'safety', 'diet'] as const;
export type Criterion = typeof CRITERIA[number];

const CRITERIA_TEXT: Record<Criterion, string> = {
  quantities: "quantités dans les étapes : chaque étape reprend la quantité des ingrédients qu'elle utilise (« ajoute 200 g de riz »), on peut cuisiner sans remonter à la liste. 5 : toujours ; 3 : environ la moitié ; 1 : jamais.",
  cooking_cues: "temps, températures et signes de cuisson : chaque cuisson a une durée, un niveau de feu ou une température (four en °C), et un repère visuel ou de texture (doré, tendre à la pointe du couteau, jus clair). 5 : toutes les cuissons ; 1 : aucune.",
  order: "ordre logique : préparations avant les cuissons, cuissons longues lancées tôt, aucun ingrédient utilisé avant d'avoir été préparé, pas d'étape oubliée (préchauffer le four, cuire le riz…). 5 : parfait ; 1 : la recette ne peut pas être suivie.",
  ingredients_used: "ingrédients tous utilisés : cohérence entre la liste d'ingrédients de la recette et ses étapes seulement. Chaque ingrédient de la liste apparaît dans les étapes, et les étapes n'utilisent rien qui ne soit dans la liste (sauf eau, sel, poivre). 5 : parfait ; retire un point par oubli ou ajout. Ne pénalise ni un garde-manger utilisé en partie, ni un ingrédient à acheter (ail, herbes…) s'il est dans la liste.",
  authenticity: "authenticité : la recette est typique de la cuisine demandée (plat, épices, techniques, nom), ou, en cuisine libre, cohérente et appétissante ; pas de mélange incohérent. 5 : un cuisinier de cette cuisine la reconnaîtrait ; 1 : sans rapport.",
  safety: "sécurité alimentaire : volaille, porc, viande hachée et poisson cuits à cœur avec un repère (température ou signe : plus rose, jus clair) ; reste de plat réchauffé une seule fois, bien à cœur (fumant) ; riz cuit réchauffé à cœur et jamais laissé tiède ; œufs crus seulement si c'est sans risque ; aucun conseil dangereux. 5 : rien à redire (ou aucun aliment à risque) ; 1 : risque réel.",
  diet: "respect des régimes et des aliments exclus demandés, et des ingrédients réservés (sélection) : 5 si tout est respecté (ou rien n'est demandé) ; 1 si un ingrédient interdit est utilisé.",
};

export const JUDGE_SCHEMA = {
  type: 'object',
  properties: {
    recipes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          index: { type: 'integer' },
          scores: {
            type: 'object',
            properties: Object.fromEntries(CRITERIA.map((criterion) => [criterion, { type: 'integer' }])),
            required: [...CRITERIA],
          },
          issues: { type: 'array', items: { type: 'string' }, description: 'Problèmes concrets, en français, une phrase chacun' },
          strengths: { type: 'array', items: { type: 'string' }, description: 'Points forts, en français, une phrase chacun' },
        },
        required: ['index', 'scores', 'issues', 'strengths'],
      },
    },
    diversity: { type: 'integer', description: 'Diversité entre les recettes de la génération' },
    diversity_comment: { type: 'string' },
  },
  required: ['recipes', 'diversity', 'diversity_comment'],
};

// Situation demandée, telle que l'app l'a envoyée
export interface JudgeCase {
  id: string;
  language: string;
  cuisine: string;
  meal_type: string;
  dietary: string[];
  excluded: string[];
  mode: string;
  selection: boolean;
  other_pantry: string[];
  pantry: { name: string; quantity?: string; kind?: string; days_left?: number | null }[];
}

export function judgePrompt(situation: JudgeCase, recipes: unknown[]): string {
  const pantry = situation.pantry.map((item) =>
    `- ${item.name}${item.quantity ? ` (${item.quantity})` : ''}${item.kind === 'dish' ? ' [reste de plat déjà cuisiné]' : ''}${typeof item.days_left === 'number' && item.days_left <= 2 ? ' [à utiliser vite]' : ''}`).join('\n');
  return `Tu es un chef et un inspecteur d'hygiène exigeant. Tu évalues des recettes écrites par une application anti-gaspi, pour des cuisiniers amateurs qui suivent les étapes à la lettre. Sois sévère et précis : une note de 5 doit être méritée.

SITUATION DEMANDÉE
- Langue : ${situation.language}
- Cuisine : ${situation.cuisine === 'any' ? 'libre' : situation.cuisine}
- Repas : ${situation.meal_type}
- Régimes : ${situation.dietary.length > 0 ? situation.dietary.join(', ') : 'aucun'}
- Aliments exclus : ${situation.excluded.length > 0 ? situation.excluded.join(', ') : 'aucun'}
- Mode : ${situation.mode === 'leftovers' ? 'transformer les restes (chaque recette part d\'un reste de plat)' : 'standard'}${situation.selection ? `
- Sélection : cuisiner seulement avec les ingrédients listés ; réservés, à ne pas utiliser : ${situation.other_pantry.join(', ') || 'aucun'}` : ''}
- Garde-manger :
${pantry}

GRILLE (note chaque recette de 1 à 5 sur chaque critère)
${CRITERIA.map((criterion) => `- ${criterion} : ${CRITERIA_TEXT[criterion]}`).join('\n')}

Note aussi "diversity" (1 à 5) : les recettes de cette génération sont-elles vraiment différentes (plat, technique, texture, saveurs) ? 5 : trois plats qu'on n'hésiterait pas à proposer ensemble ; 1 : variantes du même plat.

Pour chaque recette, "index" est sa position (0, 1, 2…). "issues" : les problèmes concrets (cite l'étape), en français ; "strengths" : les vrais points forts. Ne note pas le style d'écriture ni la longueur.

RECETTES (JSON)
${JSON.stringify(recipes.map((recipe: any, index: number) => ({
    index,
    title: recipe.title,
    description: recipe.description,
    servings: recipe.servings,
    total_time: recipe.total_time,
    ingredients: (recipe.ingredients_used ?? []).map((i: any) => `${i.quantity} ${i.unit} ${i.name}`.replace(/\s+/g, ' ').trim()),
    instructions: recipe.instructions,
    tips: recipe.tips,
  })), null, 1)}`;
}

// ---------- Variété sur plusieurs générations (même garde-manger) ----------

export const VARIETY_SCHEMA = {
  type: 'object',
  properties: {
    recipes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          generation: { type: 'integer' },
          index: { type: 'integer' },
          group: { type: 'integer', description: 'Numéro du plat : même numéro pour le même plat ou une variante trop proche' },
          library_dish: { type: 'string', description: 'Plat de référence le plus proche, ou chaîne vide' },
          relation: { type: 'string', enum: ['copy', 'variant', 'new'] },
        },
        required: ['generation', 'index', 'group', 'library_dish', 'relation'],
      },
    },
    comment: { type: 'string' },
  },
  required: ['recipes', 'comment'],
};

export function varietyPrompt(cuisine: string, generations: { title: string; description?: string; ingredients?: string[]; instructions?: string[] }[][], libraryNames: string[]): string {
  return `Tu compares des recettes proposées par une application de cuisine à la même personne, avec le même garde-manger, lors de ${generations.length} générations successives (cuisine : ${cuisine === 'any' ? 'libre' : cuisine}).

1. Regroupe les recettes qui sont le même plat ou une variante trop proche pour que la personne ait l'impression qu'on lui propose la même chose (même plat de base, même technique, mêmes saveurs dominantes ; un simple changement d'accompagnement ou d'épice ne suffit pas à en faire un autre plat). "group" : un numéro par plat distinct (1, 2, 3…), le même pour les recettes regroupées.
2. Compare chaque recette aux plats de référence ci-dessous :
   - "copy" : c'est un plat de référence reproduit tel quel (même plat, ses ingrédients essentiels et sa technique, sans adaptation notable) ;
   - "variant" : inspirée d'un plat de référence, mais adaptée (ingrédients changés, technique ou forme différente) ;
   - "new" : aucun plat de référence n'y correspond vraiment.
   "library_dish" : le nom du plat de référence le plus proche ("" pour "new").

PLATS DE RÉFÉRENCE (noms) : ${libraryNames.length > 0 ? libraryNames.join(' ; ') : 'aucun'}

RECETTES
${generations.map((recipes, g) => recipes.map((recipe, i) => `- génération ${g}, index ${i} : ${recipe.title}${recipe.description ? ` — ${recipe.description}` : ''}${recipe.ingredients?.length ? ` [${recipe.ingredients.join(', ')}]` : ''}${recipe.instructions?.length ? ` Étapes : ${recipe.instructions.join(' / ').slice(0, 600)}` : ''}`).join('\n')).join('\n')}

"comment" : en français, deux phrases sur la variété observée.`;
}
