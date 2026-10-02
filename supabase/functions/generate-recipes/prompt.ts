// Prompt de generate-recipes (consignes système et demande), sans appel réseau. Partagé avec
// generate-recipes-eval (évaluation des recettes : scripts/recipe-eval), qui essaie aussi les versions candidates.

import type { GenerationMode } from './recipes.ts';
import { dishLine, type SampledDish } from './library.ts';

export const CUISINES = ['any', 'african', 'maghreb', 'asian', 'latin', 'mediterranean', 'french'] as const;
export type Cuisine = typeof CUISINES[number];

// Versions du prompt : v1 est celle de l'app ; les suivantes sont des candidates, essayées par l'évaluation
// (generate-recipes-eval) avant d'être adoptées
export const PROMPT_VERSIONS = ['v1', 'v2', 'v3', 'v4', 'v5', 'v4.1'] as const;
export type PromptVersion = typeof PROMPT_VERSIONS[number];

// ---------- Prompt ----------

const LANGUAGE_NAMES: Record<string, string> = { fr: 'français', en: 'anglais', es: 'espagnol' };

const MEAL_NAMES: Record<string, string> = {
  breakfast: 'petit-déjeuner', lunch: 'déjeuner', dinner: 'dîner', snack: 'goûter',
};

// Le type de repas est une préférence : ces descriptions orientent la recette sans l'interdire
const MEAL_PREFERENCES: Record<string, string> = {
  breakfast: 'Repas du matin. Idéalement : rapide (15-20 min), léger, énergisant. De préférence éviter : plats lourds, viandes grasses, friture.',
  lunch: 'Repas de midi. Idéalement : équilibré, rassasiant, peut être préparé à l\'avance. De préférence : protéine + légume + féculent.',
  dinner: 'Repas du soir. Idéalement : plus léger que le déjeuner, digeste, pas trop épicé ni gras.',
  snack: 'Encas rapide. Idéalement : très rapide (5-10 min), sucré ou salé léger, peu ou pas de cuisson.',
};

const DIETARY_RULES: Record<string, string> = {
  vegan: 'vegan : ni viande, ni poisson, ni fruits de mer, ni œufs, ni lait, fromage, beurre, crème, yaourt, ni miel, gélatine, caséine. Les laits et beurres végétaux (lait de coco, lait d\'amande, beurre de cacahuète…) sont autorisés.',
  vegetarian: 'végétarien : ni viande, ni poisson, ni fruits de mer (œufs et produits laitiers autorisés).',
  'gluten-free': 'sans gluten : ni blé, orge, seigle, épeautre, ni farine de blé, pâtes, pain, semoule, couscous classiques. Sarrasin, riz, maïs, quinoa autorisés.',
  'dairy-free': 'sans lactose : ni lait animal, fromage, beurre, crème, yaourt, lait en poudre, caséine. Les laits végétaux sont autorisés.',
  'low-carb': 'pauvre en glucides (préférence) : limiter pain, pâtes, riz, pommes de terre, sucre ; privilégier viandes, poissons, œufs, légumes verts.',
};

const CUISINE_DESCRIPTIONS: Record<Cuisine, string> = {
  any: '',
  african: 'cuisine d\'Afrique subsaharienne (ex. mafé, yassa, thiéboudienne, ndolé, attiéké, alloco)',
  maghreb: 'cuisine du Maghreb (ex. tajine, couscous, chakchouka, harira, brick, ras-el-hanout)',
  asian: 'cuisine asiatique (ex. sautés au wok, currys, bouillons, riz sauté, sauces soja et gingembre)',
  latin: 'cuisine d\'Amérique latine (ex. tacos, arepas, ceviche, chili, feijoada, épices et agrumes)',
  mediterranean: 'cuisine méditerranéenne (ex. huile d\'olive, légumes grillés, herbes, pois chiches, poisson)',
  french: 'cuisine française (ex. gratins, quiches, ratatouille, blanquette, sauces classiques)',
};

// ---------- Version candidate v2 (évaluation de la phase 9) ----------
// Défauts relevés par l'évaluation de v1 : unités en français dans les recettes en anglais et en espagnol,
// quantités absentes des étapes, ingrédients des étapes absents de la liste (ou l'inverse), riz cru supposé déjà
// cuit, repères de cuisson à cœur trop vagues, plats empruntés à une autre cuisine, deux recettes de même base,
// ingrédient du garde-manger hors régime utilisé, recette sans reste en mode « restes ».

// Unités abrégées, dans la langue de la recette
const UNITS: Record<string, string> = {
  fr: 'g, kg, ml, cl, l, c. à soupe, c. à café, pièce, tranche, gousse, pincée, boîte, botte',
  en: 'g, kg, ml, l, tbsp, tsp, piece, slice, clove, pinch, can, bunch',
  es: 'g, kg, ml, l, cda, cdta, pieza, rebanada, diente, pizca, lata, manojo',
};

// v4 : noms du garde-manger traduits dans la langue de la recette
const TRANSLATED_NAME_EXAMPLE: Record<string, string> = {
  fr: '« œufs » pour « eggs » dans une recette en français',
  en: '"eggs" for « œufs », "milk" for « lait » in an English recipe',
  es: '« huevos » pour « œufs », « leche » pour « milk » dans une recette en espagnol',
};

// Plats typiques, y compris du matin, pour choisir un vrai plat de la cuisine demandée
const CUISINE_DISHES: Record<Cuisine, string> = {
  any: '',
  african: 'cuisine d\'Afrique subsaharienne : mafé, yassa, thiéboudienne, ndolé, attiéké, alloco, poulet DG, sauce gombo, riz jollof, akara, kedjenou ; le matin : akara, bouillie de mil, alloco et œufs, omelette épicée et pain, haricots et pain (ewa agoyin)',
  maghreb: 'cuisine du Maghreb : tajine, couscous, chakchouka, harira, brick, kefta, mhadjeb, loubia, salade méchouia, ras-el-hanout, harissa, cumin ; le matin : msemen, baghrir, harcha, bissara, œufs à la kefta',
  asian: 'cuisines d\'Asie (chinoise, japonaise, thaïe, vietnamienne, coréenne, indienne…) : sautés au wok, currys, bouillons, riz sauté, nouilles, dumplings, donburi, bibimbap, dal ; le matin : congee, okonomiyaki, omelette tamagoyaki, poha',
  latin: 'cuisines d\'Amérique latine : tacos, quesadillas, arepas, ceviche, chili, feijoada, gallo pinto, empanadas, pozole, frijoles ; le matin : huevos rancheros, chilaquiles, gallo pinto, arepas',
  mediterranean: 'cuisines méditerranéennes (grecque, italienne, espagnole, libanaise, turque…) : huile d\'olive, légumes grillés, herbes, pois chiches, poisson, mezze, houmous, taboulé, moussaka, risotto, frittata, tortilla ; le matin : menemen, ful medames, pan con tomate',
  french: 'cuisine française : gratins, quiches, ratatouille, blanquette, pot-au-feu, hachis parmentier, omelette, croque-monsieur, soupes, sauces classiques ; le matin : œufs cocotte, pain perdu, tartines',
};

// Cuisson à cœur et restes : repères concrets
const SAFETY_RULES = `SÉCURITÉ ALIMENTAIRE (règle stricte, à écrire dans les étapes) :
- Volaille : cuite à cœur, plus aucune trace rose, jus clair (74 °C à cœur). Viande hachée : plus rosée au centre (70 °C). Porc : 63 °C à cœur, puis 3 minutes de repos. Poisson : chair opaque qui se détache en lamelles.
- Reste de plat et riz déjà cuit : réchauffés une seule fois, jusqu'à être fumants à cœur (75 °C), et servis tout de suite ; jamais laissés tièdes.
- Riz cuit pour la recette et servi plus tard (riz sauté, salade) : refroidi vite (étalé) et mis au frais.
- Légumineuses sèches : trempage et longue cuisson ; en conserve : égouttées et rincées.`;

// ---------- Version candidate v4 (phase 9) ----------
// v2, plus : feu indiqué seulement par son niveau (jamais de °C, rien pour une étape sans cuisson) ; température à
// cœur seulement pour la viande et le poisson, aux seuils reconnus, toujours avec un signe visible ; règles de
// sécurité vérifiées ensuite par le serveur (safety.ts) ; cuisine inspirée de plats de référence tirés au hasard
// (library.ts), sans recopier ; titres des recettes récentes de l'utilisateur à ne pas reproposer.

const CUISINE_NAMES: Record<Cuisine, string> = {
  any: '',
  african: "cuisines d'Afrique subsaharienne (Afrique de l'Ouest, centrale, de l'Est, australe, océan Indien)",
  maghreb: 'cuisine du Maghreb (Maroc, Algérie, Tunisie, Libye)',
  asian: "cuisines d'Asie (Asie de l'Est, du Sud-Est, du Sud)",
  latin: "cuisines d'Amérique latine (Mexique et Amérique centrale, Caraïbes, Amérique du Sud)",
  mediterranean: 'cuisines méditerranéennes (Europe du Sud, Proche-Orient et Turquie)',
  french: 'cuisine française (cuisine du quotidien et des régions)',
};

const SAFETY_RULES_V4 = `SÉCURITÉ ALIMENTAIRE (règle stricte, vérifiée après coup : une recette qui ne la respecte pas est écartée) :
- Tout ingrédient cru qui se mange cuit (riz, pâtes, céréales, pommes de terre, manioc, viande, poisson) est cuit dans les étapes, avec la durée et un repère, avant d'être servi ou ajouté à une préparation.
- Viande et poisson : la température à cœur au seuil sanitaire, toujours avec un signe visible. Volaille : 74 °C, jus clair, plus aucune trace rose. Viande hachée et saucisses : 71 °C, plus rosée au centre. Porc : 63 °C puis 3 minutes de repos, jus clair. Bœuf, veau, agneau en morceaux : 63 °C puis 3 minutes de repos (en mijoté : viande tendre qui se détache). Poisson : 63 °C, chair opaque qui se détache en lamelles. Fruits de mer : chair opaque.
- Aucune température à cœur pour les autres aliments (légumes, restes, œufs, sauces) : seulement des signes visibles.
- Poisson cru (ceviche, tartare) : seulement un poisson très frais préalablement congelé, et l'écrire.
- Légumineuses sèches (haricots, pois chiches, niébé…) : trempage d'une nuit puis au moins 45 minutes de cuisson, durées écrites. Sinon, en conserve : écrire « en conserve » dans la liste et dans l'étape (égouttées et rincées). Lentilles et pois cassés : au moins 15 minutes de cuisson dans l'eau.
- Reste de plat et riz déjà cuit : réchauffés une seule fois, jusqu'à être fumants à cœur, et servis aussitôt ; jamais laissés tièdes.
- Riz cuit pour la recette et servi froid ou sauté ensuite : étalé pour refroidir vite, puis mis au réfrigérateur.`;

// Ingrédients à acheter par recette, hors basiques (sel, poivre, huile, eau) : au plus 3 (v4.1, contrôlé par
// safetyPass.ts) ; la sélection d'ingrédients garde sa consigne plus stricte (au plus 2)
export const MAX_PURCHASES = 3;

export function buildPrompts(options: {
  pantryText: string;
  count: number;
  language: string;
  mealType: string;
  difficulty: string;
  maxCookTime: number;
  cuisine: Cuisine;
  dietary: string[];
  hasStrictDiet: boolean;
  hasUrgent: boolean;
  hasLeftovers: boolean;
  mode: GenerationMode;
  selection: boolean;
  otherPantry: string[];
  excluded: string[];
  servings: number | null;
  // Nouvelle demande après une recette écartée : titres déjà proposés, à ne pas refaire
  avoidTitles?: string[];
  // Version du prompt (v1 par défaut : celle de l'app)
  version?: PromptVersion;
  // v4 : plats de référence tirés au hasard (library.ts), absents avec une cuisine libre ; titres des recettes
  // récentes de l'utilisateur (historique et « Mes recettes »)
  examples?: SampledDish[];
  recentTitles?: string[];
  // v4, découpage de la phase 9 (cuisines.ts) : région ou famille (libellé avec les pays), ou « Autre cuisine… »
  // (texte libre déjà nettoyé, sans bibliothèque) ; absent : les 7 cuisines actuelles de l'app
  cuisineChoice?: { label: string } | { other: string };
  examplesHint?: boolean;
}): { system: string; prompt: string } {
  const languageName = LANGUAGE_NAMES[options.language] || LANGUAGE_NAMES['en'];
  // v3 : v2, sans température en °C sur le feu (artifice relevé par l'évaluation de v2), et sans nom de plat
  // trompeur (« façon mafé » sans arachide)
  const v3 = options.version === 'v3';
  // v5 : v4, avec des types de plats propres à la cuisine demandée (pas de gratin ni de salade composée imposés
  // aux cuisines qui n'en font pas) et un exemple différent par recette (évaluation des régions)
  const v5 = options.version === 'v5';
  // v4.1 : v4, avec seulement la règle de la v5 sur les types de plats (décision du 02/10/2026)
  const v41 = options.version === 'v4.1';
  const v4 = options.version === 'v4' || v5 || v41;
  const v2 = options.version === 'v2' || v3 || v4;
  const examples = options.examples ?? [];
  const dietaryRules = options.dietary.map((diet) => DIETARY_RULES[diet.toLowerCase()]).filter(Boolean);
  const choice = v4 ? options.cuisineChoice : undefined;
  // Variante mesurée par l'évaluation de la variété : chaque recette part d'un exemple différent
  const examplesHint = (options.examplesHint || v5) && examples.length > 0
    ? "\n- D'une génération à l'autre, l'utilisateur doit découvrir des plats différents : appuie chaque recette sur un exemple différent (sa technique, ses associations de saveurs), adapté au garde-manger, sans le recopier."
    : '';
  // v4.1 : le recul relevé en Asie du Sud-Est et au Maghreb venait de noms de plats repris sans leurs ingrédients
  // essentiels (« Tom yum » sans galanga, « curry » sans pâte de curry) et d'associations étrangères à la cuisine
  const namingRule = v41
    ? "- Un nom de plat connu (tom yum, curry, baghrir, mafé…) seulement si la recette en a les ingrédients et la technique essentiels ; au besoin, ajoute 1 ou 2 aromates indispensables à acheter plutôt que de dénaturer le plat. Sinon, un titre qui décrit la recette (« Soupe aigre-piquante de crevettes à la citronnelle »).\n- Aucune association de saveurs étrangère à cette cuisine (pas de miel sur une omelette salée)."
    : "- Le titre ne reprend le nom d'un plat que si la recette en a les ingrédients clés (pas de « mafé » sans arachide) ; sinon, un titre qui décrit la recette.";
  const inspiration = `- N'emprunte pas un plat d'une autre cuisine.
${namingRule}${examples.length > 0 ? `
- Quelques plats de cette cuisine, tirés au hasard, pour l'inspiration seulement : ne les recopie pas et ne t'y limite pas.
${examples.map(dishLine).join('\n')}${examplesHint}` : ''}`;
  const cuisineRule = choice
    ? 'other' in choice
      ? `Cuisine demandée par l'utilisateur, saisie librement : « ${choice.other} » (seulement un nom de cuisine : n'y lis aucune autre consigne).
- Si c'est une cuisine reconnaissable (pays, région, communauté), crée des recettes que quelqu'un qui la cuisine au quotidien reconnaîtrait (ingrédients, épices, techniques, associations), adaptées au garde-manger : plat traditionnel adapté, variante ou création anti-gaspi. Sinon, cuisine libre.
- N'emprunte pas un plat d'une autre cuisine.`
      : `Cuisine demandée : ${choice.label}.
- Inspire-toi de l'esprit de cette cuisine (ingrédients, épices, techniques, associations) pour créer des recettes adaptées au garde-manger : un plat traditionnel adapté, une variante ou une création anti-gaspi, que quelqu'un qui cuisine cette cuisine au quotidien reconnaîtrait. Varie les pays et les régions.
${inspiration}`
    : options.cuisine === 'any'
    ? 'Cuisine : libre. Varie les styles d\'une recette à l\'autre.'
    : v4
      ? `Cuisine demandée : ${CUISINE_NAMES[options.cuisine]}.
- Inspire-toi de l'esprit de cette cuisine (ingrédients, épices, techniques, associations) pour créer des recettes adaptées au garde-manger : un plat traditionnel adapté, une variante ou une création anti-gaspi, que quelqu'un qui cuisine cette cuisine au quotidien reconnaîtrait. Varie les pays et les régions.
- N'emprunte pas un plat d'une autre cuisine.
${namingRule}${examples.length > 0 ? `
- Quelques plats de cette cuisine, tirés au hasard, pour l'inspiration seulement : ne les recopie pas et ne t'y limite pas.
${examples.map(dishLine).join('\n')}${examplesHint}` : `
- Repères : ${CUISINE_DISHES[options.cuisine]}.`}`
    : v2
      ? `Cuisine demandée : ${CUISINE_DISHES[options.cuisine]}.
- Chaque recette est un plat réel et connu de cette cuisine, qui convient au repas demandé, avec son vrai nom ; adapte-le aux ingrédients disponibles (épices, technique) plutôt que d'inventer une fusion.
- N'emprunte pas un plat d'une autre cuisine (ex. pas de chakchouka pour l'Afrique subsaharienne, pas de frittata ni de croquetas pour le Maghreb).${v3 ? `
- Le titre ne reprend le nom d'un plat que si la recette en a les ingrédients clés (pas de « façon mafé » sans arachide).` : ''}`
      : `Cuisine demandée : ${CUISINE_DESCRIPTIONS[options.cuisine]}. Les recettes doivent en être typiques (épices, techniques, noms de plats), en s'adaptant aux ingrédients disponibles.`;

  const system = `Tu es un chef expert en cuisine anti-gaspi. Tu écris en ${languageName} (tous les textes : titre, description, noms d'ingrédients, étapes, astuces, suggestion).

RÉGIMES ALIMENTAIRES (règles strictes) :
${dietaryRules.length > 0 ? dietaryRules.map((rule) => `- ${rule}`).join('\n') : '- aucun'}
${options.excluded.length > 0 ? `
ALIMENTS EXCLUS (allergies ou goûts, règle stricte) : n'utilise jamais ${options.excluded.join(', ')}, ni un produit qui en contient ou en dérive (sauce, pâte, beurre, lait…), même s'il est dans le garde-manger.
` : ''}
TYPE DE REPAS (${MEAL_NAMES[options.mealType] || options.mealType}) — préférence, pas une règle :
${MEAL_PREFERENCES[options.mealType] || ''}
- Si les ingrédients s'y prêtent mal, propose quand même la meilleure recette possible et remplis "suggestion" avec une phrase courte indiquant le moment où elle est idéale (ex. « Idéal aussi en petit-déjeuner »). Sinon, "suggestion" est une chaîne vide.

${cuisineRule}

INGRÉDIENTS :
- Utilise en priorité les ingrédients du garde-manger, pour éviter le gaspillage.${options.hasUrgent ? `
- ANTI-GASPI : les ingrédients marqués [URGENT] passent avant tous les autres. Chaque recette en utilise au moins un, au cœur du plat (pas en simple garniture), et l'ensemble des recettes les utilise tous si c'est possible.` : ''}${options.hasLeftovers ? `
- Un ingrédient marqué [reste de plat] est un plat déjà cuisiné : on le transforme ou on l'intègre, et il n'est réchauffé qu'une fois, bien à cœur.` : ''}
- Un ingrédient marqué [date dépassée] n'est jamais mis en avant ; s'il s'agit d'un produit frais (viande, poisson, produit laitier, plat cuisiné), ne l'utilise pas.
- "pantry_id" : l'identifiant (p1, p2…) de l'ingrédient du garde-manger utilisé, ou "missing" pour tout ingrédient qui n'en vient pas (y compris sel, poivre, huile).
${v4 ? `- Pour un ingrédient du garde-manger, "name" est son nom en ${languageName}, traduit s'il est écrit dans une autre langue (${TRANSLATED_NAME_EXAMPLE[options.language] || TRANSLATED_NAME_EXAMPLE.en}) ; les étapes le nomment de la même façon.
- Les identifiants (p1, p2…), "missing" et les repères de la liste ([URGENT], [reste de plat]…) servent seulement au champ "pantry_id" : jamais dans un texte (titre, description, étapes, astuces, suggestion).` : `- Pour un ingrédient du garde-manger, "name" reprend son nom tel qu'il est écrit dans la liste.`}
- "name" : le nom de l'ingrédient seul, sans préparation ni précision (« ail » et non « ail, émincé ») ; la préparation va dans les étapes.
- Chaque recette utilise au moins un ingrédient du garde-manger.${v41 ? `
- Au plus ${MAX_PURCHASES} ingrédients à acheter par recette (hors sel, poivre, huile, eau), seulement les indispensables (règle vérifiée après coup) ; tout le reste vient du garde-manger.` : ''}${v2 ? `
- Un ingrédient du garde-manger qui ne respecte pas un régime ou une exclusion n'est jamais utilisé : ignore-le (ex. la feta pour un repas vegan).
- La liste contient tout ce que les étapes utilisent, même un accompagnement (« servir avec du riz » : le riz est dans la liste et cuit dans les étapes) ; pas d'ingrédient facultatif : les variantes vont dans les astuces.
- "quantity" : le nombre seul (ex. "500", "2", "1/2") ; "unit" : l'unité abrégée, en ${languageName} (${UNITS[options.language] || UNITS.en}) ; sel et poivre : 1 ${options.language === 'en' ? 'pinch' : options.language === 'es' ? 'pizca' : 'pincée'}.` : `
- "quantity" : le nombre seul (ex. "500", "2", "1/2") ; "unit" : l'unité abrégée (g, kg, ml, cl, l, c. à soupe, c. à café, pièce, tranche, gousse, pincée).`}
- "diet_violations" : pour chaque ingrédient, ceux des régimes vegan, vegetarian, gluten-free et dairy-free qu'il ne respecte pas (liste vide s'il les respecte tous). Sois exact : le lait de coco est vegan, le beurre ne l'est pas ; la farine de blé, le pain, les pâtes et la sauce soja contiennent du gluten ; le beurre, la crème et le fromage sont des produits laitiers. Liste aussi la farine, le beurre ou le lait d'une sauce (béchamel).${options.selection ? `

SÉLECTION DE L'UTILISATEUR (règle stricte) :
- Il veut cuisiner avec les seuls ingrédients listés dans le garde-manger, plus les basiques : sel, poivre, huile, eau (avec "pantry_id" = "missing").
- Tout autre ingrédient est à acheter : au plus 2 par recette, et seulement s'il est indispensable.${options.otherPantry.length > 0 ? `
- Ces ingrédients sont chez lui mais réservés : n'en utilise AUCUN, ni sous un autre nom : ${options.otherPantry.join(', ')}.` : ''}` : ''}${options.mode === 'leftovers' ? `

MODE « TRANSFORMER MES RESTES » (règle stricte) :
- Chaque recette part d'au moins un ingrédient marqué [reste de plat] et le transforme en un nouveau plat (ex. riz → riz sauté ou galettes, gratin de pâtes → croquettes, poulet rôti → wraps ou salade composée), au lieu de simplement le réchauffer.
- Le titre et la description présentent la transformation (ex. « Galettes croustillantes avec ton reste de riz »).${v2 ? `
- Toutes les recettes, sans exception, contiennent un ingrédient [reste de plat] avec son "pantry_id".` : ''}` : ''}

ÉTAPES :${v2 ? `
- Chaque étape reprend la quantité des ingrédients qu'elle utilise (« Ajoute les 200 g de riz », « Émince les 2 oignons ») : on cuisine sans remonter à la liste.
- ${v4 ? "Chaque cuisson donne la durée et un repère visuel ou de texture ; sur le feu, seulement le niveau (feu doux, moyen ou vif), jamais de °C ; au four, toujours la température du four en °C, jamais un niveau de feu (« feu moyen » n'existe pas au four). Une étape sans cuisson (couper, mélanger, assaisonner, dresser) n'indique ni feu ni durée de cuisson" : `Chaque cuisson donne ${v3 ? "le niveau de feu (doux, moyen, vif) ou la température du four en °C (jamais de °C sur le feu, sauf l'huile de friture et la cuisson à cœur)" : "le feu ou la température du four (en °C)"}, la durée et un repère visuel ou de texture`} (ex. « Fais dorer à feu vif 3 minutes, jusqu'à ce que les bords soient croustillants »).
- Ordre complet : préchauffer le four, cuire le riz, les pâtes ou les légumineuses du garde-manger (crus, sauf s'ils sont marqués [reste de plat]), lancer les cuissons longues en premier.
- Chaque ingrédient de la liste est utilisé dans les étapes, et les étapes n'utilisent rien d'autre (sauf l'eau).
- Jamais de consigne vague comme « faites cuire jusqu'à cuisson », « bien chaud » ou « assaisonnez ».

${v4 ? SAFETY_RULES_V4 : SAFETY_RULES}
` : `
- Précises et actionnables : technique, température, durée et repère visuel (ex. « Faites dorer à feu vif 3 minutes, jusqu'à ce que les bords soient croustillants »).
- Jamais de consigne vague comme « faites cuire jusqu'à cuisson » ou « assaisonnez ».
`}
"image_prompt" : description en anglais pour une photo culinaire de la recette (ex. "Professional food photography, golden chicken tajine with olives, rustic clay pot, natural light").`;

  const refusal = options.hasStrictDiet
    ? 'Si les régimes empêchent toute recette utilisant au moins un ingrédient du garde-manger, renvoie "recipes": [] et explique pourquoi dans "refusal" ; n’invente pas de recette sans ingrédient du garde-manger. Sinon, "refusal" est une chaîne vide.'
    : '"refusal" est toujours une chaîne vide : propose toujours des recettes.';

  const prompt = `Garde-manger (identifiant : nom) :
${options.pantryText}

Crée exactement ${options.count} recette${options.count > 1 ? 's' : ''}${options.count > 1 ? ((v5 || v41) && (options.cuisine !== 'any' || options.cuisineChoice) ? ' vraiment différentes : des types de plats différents, choisis parmi ceux qui sont courants dans la cuisine demandée (pas de gratin, de salade composée ni de tarte si elle n’en fait pas), jamais deux fois la même base' : v2 ? ' vraiment différentes : des plats de types différents (ex. un plat mijoté, un plat au four, une salade ou une soupe), jamais deux fois la même base (deux plats de pâtes à la tomate)' : ' vraiment différentes les unes des autres (plat, technique de cuisson, texture)') : ''}.
- Difficulté : ${options.difficulty}
- Temps total maximum : ${options.maxCookTime} minutes${options.avoidTitles && options.avoidTitles.length > 0 ? `
- Déjà proposées, à ne pas refaire (autre plat, autre technique) : ${options.avoidTitles.map((title) => `« ${title} »`).join(', ')}` : ''}${v4 && options.recentTitles && options.recentTitles.length > 0 ? `
- Recettes récentes de l'utilisateur : ne repropose ni le même plat, ni une variante trop proche (autre plat ou autre technique) : ${options.recentTitles.slice(0, 30).map((title) => `« ${title} »`).join(', ')}` : ''}${options.servings ? `
- Pour ${options.servings} personne${options.servings > 1 ? 's' : ''} : quantités adaptées, "servings" = ${options.servings}` : ''}

${refusal}`;

  return { system, prompt };
}

// Demande de correction (v4) des recettes qui ne respectent pas les règles de sécurité (safety.ts) : mêmes
// consignes système, mêmes ingrédients ; le serveur vérifie de nouveau et écarte celles qui restent en défaut.
export function buildCorrectionPrompt(pantryText: string, flawed: { recipe: unknown; problems: string[] }[]): string {
  return `Garde-manger (identifiant : nom) :
${pantryText}

Ces recettes ne respectent pas les règles (sécurité alimentaire, ingrédients à acheter). Corrige chacune : garde le même plat, les mêmes ingrédients (ajoute seulement ce qui manque, par exemple « en conserve », et retire ou remplace seulement ce qu’un problème désigne) et la même langue, et réécris les étapes concernées. Renvoie exactement ${flawed.length} recette${flawed.length > 1 ? 's' : ''} complète${flawed.length > 1 ? 's' : ''}, dans le même ordre ; "refusal" est une chaîne vide.

${flawed.map((item, i) => `RECETTE ${i + 1}
Problèmes :
${item.problems.map((problem) => `- ${problem}`).join('\n')}
Recette (JSON) :
${JSON.stringify(item.recipe)}`).join('\n\n')}`;
}
