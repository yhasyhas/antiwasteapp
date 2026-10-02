// Contrôle de sécurité alimentaire des recettes après la génération (phase 9), sans appel réseau ni dépendance :
// partagé par le serveur (recette écartée ou corrigée) et par l'évaluation (scripts/recipe-eval, importé par Node).
// Règles vérifiées, en français, anglais et espagnol :
// - tout ingrédient cru à cuire (riz, pâtes, céréales, pommes de terre, viande, poisson) est cuit dans les étapes ;
// - légumineuses sèches : trempage et longue cuisson, sinon « en conserve » précisé ;
// - viande et poisson crus : température à cœur au seuil reconnu et signe visible ;
// - restes de plat et riz déjà cuit : réchauffés à cœur (fumants) ;
// - riz cuit pour la recette puis refroidi : refroidi vite et mis au frais.
// Seulement des règles à faible risque de fausse alerte : une recette écartée à tort coûte une génération.

export interface SafetyIngredient {
  name: string;
  quantity?: string;
  unit?: string;
  // Identifiant de l'ingrédient du garde-manger, ou null
  pantry_id: string | null;
}

export interface SafetyRecipe {
  title: string;
  ingredients_used: SafetyIngredient[];
  instructions: string[];
}

export interface SafetyPantryItem {
  id: string;
  name: string;
  quantity?: string;
  kind?: string;
}

export type SafetyCode =
  | 'starch_not_cooked'
  | 'not_cooked'
  | 'dry_legumes'
  | 'core_temperature'
  | 'doneness_sign'
  | 'raw_fish'
  | 'leftover_reheat'
  | 'rice_cooling';

export interface SafetyIssue {
  code: SafetyCode;
  ingredient: string;
  // Consigne de correction, en français (renvoyée au modèle)
  message: string;
}

// ---------- Texte ----------

export const normalizeText = (text: unknown) =>
  String(text ?? '').toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9°]+/g, ' ').trim();

const STOP = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'en', 'au', 'aux', 'et', 'of', 'the', 'and', 'with', 'y', 'con', 'el', 'los', 'las', 'del', 'a', 'un', 'une',
  'reste', 'restes', 'leftover', 'leftovers', 'sobras', 'cuit', 'cuite', 'cuits', 'cuites', 'cooked', 'cocido', 'cocida', 'cocidos', 'cocidas', 'fresh', 'frais', 'fraiche', 'fresco', 'fresca',
  'boite', 'conserve', 'lata', 'can', 'canned', 'sec', 'seche', 'secs', 'dry', 'dried', 'seco', 'secos', 'gros', 'petit', 'petits', 'large', 'small', 'grand']);
// Singulier approximatif, commun aux deux formes : « ignames » et « igname » donnent « ignam »
const stem = (word: string) => (word.length > 4 ? word.replace(/(s|x)$/, '').replace(/e$/, '') : word);
const significantWords = (text: string) => normalizeText(text).split(' ').filter((w) => w.length >= 3 && !STOP.has(w)).map(stem);
const wordsOf = (text: string) => new Set(normalizeText(text).split(' ').map(stem));

// Étape qui parle de l'ingrédient : un de ses mots significatifs y figure
function mentions(step: string, name: string): boolean {
  const stepWords = wordsOf(step);
  const significant = significantWords(name);
  return significant.length > 0 && significant.some((w) => stepWords.has(w));
}

// Un des mots-clés (formes normalisées, début de mot) figure dans le texte
function hasKeyword(text: string, keywords: string[]): boolean {
  const normalized = ` ${normalizeText(text)} `;
  return keywords.some((keyword) => normalized.includes(` ${keyword}`));
}

// Durée la plus longue d'un texte, en minutes (« 10 à 12 minutes » : 12 ; « 1 h 30 » : 90)
export function longestMinutes(text: string): number {
  const normalized = normalizeText(text);
  let longest = 0;
  for (const match of normalized.matchAll(/(\d+)(?:\s*(?:a|-|to)\s*(\d+))?\s*(h|heures?|hours?|horas?|hrs?|min|minutes?|minutos?|mn)\b(?:\s*(\d+))?/g)) {
    const value = Number(match[2] ?? match[1]);
    const hours = /^h/.test(match[3]);
    const minutes = hours ? value * 60 + (match[4] ? Number(match[4]) : 0) : value;
    longest = Math.max(longest, minutes);
  }
  return longest;
}

// Températures en °C d'un texte
function celsius(text: string): number[] {
  return [...normalizeText(text).matchAll(/(\d{2,3})\s*°/g)].map((m) => Number(m[1]));
}

// ---------- Familles d'aliments ----------

const HEAT = ['cuire', 'cuis', 'cuit', 'dore ', 'dorer', 'revenir', 'revien', 'saisi', 'mijot', 'bouill', 'frire', 'frit', 'poel', 'roti', 'rotir', 'grill', 'four ', 'chauff', 'rechauff', 'brais', 'saute', 'sauter', 'blanch', 'vapeur', 'ebullition', 'fremi', 'enfourn', 'gratin', 'confi',
  'cook', 'fry', 'fried', 'simmer', 'boil', 'roast', 'bake', 'heat', 'sear', 'steam', 'brown', 'toast', 'stir fr', 'braise', 'poach', 'oven', 'microwave',
  'cocin', 'coce', 'cuece', 'cocer', 'frie', 'frei', 'dora ', 'dorar', 'doren', 'sofri', 'herv', 'hierv', 'horne', 'horno', 'asa', 'salte', 'calent', 'calien', 'tuest', 'plancha', 'guis', 'estof', 'vapor', 'microond', 'micro onde'];
const LIQUID = ['eau', 'bouillon', 'bouill', 'ebullition', 'fremi', 'mijot', 'lait ', 'vapeur', 'cuiseur', 'paquet', 'absorb',
  'water', 'boil', 'simmer', 'stock', 'broth', 'milk', 'steam', 'rice cooker', 'package', 'packet', 'absorb',
  'agua', 'herv', 'hierv', 'ebullicion', 'caldo', 'leche ', 'vapor', 'arrocera', 'paquete', 'absorb', 'fuego lento'];

// Féculents à cuire dans un liquide (riz cru supposé déjà cuit : défaut relevé en v1)
const STARCHES = ['riz', 'rice', 'arroz', 'pates', 'pasta', 'spaghetti', 'macaroni', 'penne', 'fusilli', 'tagliatelle', 'linguine', 'lasagne', 'nouille', 'noodle', 'fideo', 'vermicelle', 'vermicelli', 'ramen', 'udon', 'soba',
  'semoule', 'couscous', 'cuscus', 'boulgour', 'bulgur', 'quinoa', 'millet', 'mil ', 'fonio', 'sorgho', 'sorghum', 'sorgo', 'polenta', 'gruau', 'grits', 'avoine', 'oat', 'avena', 'orge', 'barley', 'cebada', 'sarrasin', 'buckwheat', 'trigo sarraceno'];
// « Pâte » au singulier : pâte d'arachide, de curry, feuilletée… (pas des pâtes)
const isStarch = (name: string) => {
  const n = ` ${normalizeText(name)} `;
  if (/ (lait|milk|leche|paste|farine|flour|harina|vinaigre|vinegar|vinagre|papier|paper|galette|cake|cracker|chips|crispies|son|bran|salvado) /.test(n)) return false;
  if (/ pasta (de|di) /.test(n)) return false;
  return hasKeyword(name, STARCHES);
};
// Tubercules et plantain : toujours cuits
const TUBERS = ['pomme de terre', 'pommes de terre', 'patate', 'potato', 'papa ', 'papas', 'patata', 'manioc', 'cassava', 'yuca', 'igname', 'yam', 'taro', 'macabo', 'plantain', 'platano macho', 'platano verde'];

const POULTRY = ['poulet', 'poule', 'dinde', 'canard', 'pintade', 'volaille', 'chicken', 'turkey', 'duck', 'hen', 'pollo', 'pavo', 'pato', 'gallina'];
const MINCED = ['hache', 'kefta', 'kofta', 'merguez', 'saucisse', 'chipolata', 'boulette', 'minced', 'mince', 'ground beef', 'ground pork', 'ground meat', 'ground turkey', 'ground chicken', 'ground lamb', 'sausage', 'burger', 'meatball', 'molida', 'picada', 'salchicha', 'albondiga'];
const PORK = ['porc', 'cochon', 'echine', 'pork', 'cerdo', 'puerco', 'chuleta', 'lomo de cerdo'];
const RED_MEAT = ['boeuf', 'veau', 'agneau', 'mouton', 'cabri', 'viande', 'steak', 'entrecote', 'beef', 'veal', 'lamb', 'mutton', 'goat', 'meat', 'res ', 'ternera', 'cordero', 'carnero', 'cabrito', 'carne', 'vacuno'];
const FISH = ['poisson', 'saumon', 'cabillaud', 'colin', 'merlu', 'lieu', 'thon', 'maquereau', 'sardine', 'dorade', 'daurade', 'bar ', 'loup', 'tilapia', 'truite', 'sole ', 'capitaine', 'thiof', 'merou', 'morue', 'filet de poisson',
  'fish', 'salmon', 'cod', 'haddock', 'hake', 'tuna', 'mackerel', 'trout', 'sea bass', 'bream', 'pollock', 'snapper', 'catfish',
  'pescado', 'bacalao', 'merluza', 'atun', 'caballa', 'trucha', 'sardina', 'mero', 'corvina', 'pargo', 'dorada', 'lubina', 'bagre'];
const SHELLFISH = ['crevette', 'gambas', 'langoustine', 'moule', 'calamar', 'encornet', 'poulpe', 'seiche', 'shrimp', 'prawn', 'mussel', 'squid', 'octopus', 'camaron', 'gamba', 'langostino', 'mejillon', 'pulpo', 'sepia'];
// Produits dérivés, séchés, fumés ou en conserve : ni cuisson à cœur ni signe exigés
const NOT_RAW_MEAT = ['bouillon', 'stock', 'broth', 'caldo', 'consomme', 'cube', 'cubo', 'pastilla', 'sauce', 'salsa', 'poudre', 'powder', 'polvo', 'arome', 'aroma', 'graisse', 'fat', 'grasa', 'saindoux', 'lard', 'lardon', 'bacon', 'panceta', 'tocino', 'jambon', 'ham', 'jamon',
  'chorizo', 'salami', 'saucisson', 'pepperoni', 'fume', 'smoked', 'ahumad', 'seche', 'dried', 'seco', 'seca', 'sale ', 'salted', 'salado', 'conserve', 'boite', 'canned', 'tinned', 'lata', 'enlatad', 'surimi', 'anchois', 'anchov', 'anchoa',
  'cuit', 'cooked', 'cocid', 'roti', 'roast', 'rotisserie', 'asado', 'grille', 'grilled', 'reste', 'leftover', 'sobra', 'nuoc', 'oyster', 'huitre', 'ostra', 'gelatin', 'gelatine', 'yaourt'];

const DRY_LEGUMES = ['haricot', 'pois chiche', 'lentille', 'feve', 'pois casse', 'niebe', 'cornille', 'flageolet', 'lingot', 'mogette', 'dolique', 'pois d angole', 'voandzou',
  'bean', 'chickpea', 'garbanzo', 'lentil', 'split pea', 'black eyed', 'black eye', 'pigeon pea', 'gandule', 'dal', 'dhal', 'chana', 'rajma', 'urad', 'moong',
  'frijol', 'alubia', 'judia', 'habichuela', 'lenteja', 'poroto', 'caraota'];
const NOT_DRY_LEGUME = ['vert', 'verts', 'green', 'verde', 'ejote', 'vainita', 'beurre', 'coffee', 'cafe', 'cacao', 'cocoa', 'vanill', 'jelly', 'soja', 'soy', 'edamame', 'tofu', 'tempeh', 'pate', 'paste', 'pasta', 'farine', 'flour', 'harina', 'sauce', 'salsa', 'germe', 'sprout', 'brote', 'fava fresca', 'string', 'runner', 'snap', 'baked', 'frais', 'fraiche', 'fresh', 'fresca', 'fresco'];
const QUICK_LEGUMES = ['lentille', 'lentil', 'lenteja', 'pois casse', 'split pea', 'dal', 'dhal', 'moong', 'urad'];
// Légumineuses déjà cuites : en conserve, en bocal, cuites
const CANNED = ['conserve', 'boite', 'bocal', 'canned', 'tinned', 'can of', 'cans of', 'tin of', 'jar', 'lata', 'enlatad', 'bote', 'frasco'];
const COOKED = ['cuit', 'cuite', 'cooked', 'cocid', 'precuit', 'precooked', 'precocid'];
const SOAK = ['tremp', 'soak', 'remoj'];
const PRESSURE = ['autocuiseur', 'cocotte minute', 'pressure cooker', 'instant pot', 'olla expres', 'olla a presion', 'olla de presion'];

// Restes : réchauffés jusqu'à être fumants à cœur
const REHEAT = ['fumant', 'brulant', 'a coeur', 'au coeur', 'jusqu au centre', 'au centre', 'steaming', 'piping hot', 'heated through', 'hot throughout', 'hot all the way', 'all the way through', 'through to the center', 'through to the centre',
  'humeante', 'muy caliente', 'caliente por completo', 'completamente caliente', 'hasta el centro', 'en el centro', 'por dentro'];
const COOKED_RICE = ['riz cuit', 'reste de riz', 'riz de la veille', 'cooked rice', 'leftover rice', 'day old rice', 'arroz cocido', 'arroz sobrante', 'sobras de arroz', 'arroz del dia anterior'];
const COOLING = ['refroidi', 'refroidir', 'tiedir', 'froid', 'cool', 'chill', 'cold', 'enfri', 'frio', 'fria', 'templad'];
const FAST_COOLING = ['etal', 'rapidement', 'vite', 'refrigerateur', 'frigo', 'au frais', 'spread', 'quick', 'fridge', 'refrigerat', 'extiend', 'extend', 'rapid', 'nevera', 'refriger', 'heladera', 'chill'];

// Cuisson à cœur : seuils reconnus (°C) et signes visibles
const SIGNS_MEAT = ['jus clair', 'jus soit clair', 'jus qui s ecoule', 'plus rose', 'plus de rose', 'aucune trace rose', 'sans trace rose', 'ne soit plus ros', 'plus rosee', 'se detache de l os', 'se detache', 'ferme au toucher', 'tendre', 'fondant', 'effiloch',
  'clear juice', 'juices run clear', 'no longer pink', 'no pink', 'not pink', 'falls off the bone', 'pulls away from the bone', 'firm to the touch', 'tender', 'shred',
  'jugos claros', 'jugo claro', 'ya no este ros', 'ya no ros', 'sin rastro ros', 'sin partes rosad', 'ningun rastro ros', 'no quede ros', 'se desprend', 'se deshac', 'tierna', 'tierno', 'firme al tacto', 'deshebr', 'desmenu'];
const SIGNS_FISH = ['opaque', 'se detache', 's effeuille', 'lamelle', 'a la fourchette', 'flake', 'with a fork', 'opaco', 'opaca', 'se desmenu', 'se deshac', 'se despeg', 'lamina', 'lasca', 'se separa', 'con un tenedor'];
const SIGNS_SHELLFISH = ['rose', 'opaque', 'pink', 'opaco', 'opaca', 'rosad', 's ouvr', 'ouvert', 'open', 'se abr', 'abiert'];
// Poisson cru (ceviche, tartare) : seulement s'il a été congelé avant (parasites)
const FROZEN_BEFORE = ['congele', 'surgele', 'frozen', 'congelad'];

type Protein = 'poultry' | 'minced' | 'pork' | 'red' | 'fish' | 'shellfish';
const THRESHOLDS: Record<Protein, number | null> = { poultry: 74, minced: 71, pork: 63, red: 63, fish: 63, shellfish: null };
const PROTEIN_LABEL: Record<Protein, string> = {
  poultry: 'volaille : 74 °C à cœur et jus clair, plus aucune trace rose',
  minced: 'viande hachée ou saucisse : 71 °C à cœur et plus rosée au centre',
  pork: 'porc : 63 °C à cœur puis 3 minutes de repos, jus clair',
  red: 'bœuf, veau, agneau en morceaux : 63 °C à cœur puis 3 minutes de repos (ou viande tendre qui se détache, en mijoté)',
  fish: 'poisson : 63 °C à cœur, chair opaque qui se détache en lamelles',
  shellfish: 'fruits de mer : chair opaque (crevettes roses et opaques, moules ouvertes)',
};

function proteinOf(name: string): Protein | null {
  if (hasKeyword(name, NOT_RAW_MEAT)) return null;
  // Ordre : la viande hachée avant la famille (« bœuf haché » : 71 °C)
  if (hasKeyword(name, MINCED)) return 'minced';
  if (hasKeyword(name, POULTRY)) return 'poultry';
  if (hasKeyword(name, PORK)) return 'pork';
  if (hasKeyword(name, SHELLFISH)) return 'shellfish';
  if (hasKeyword(name, FISH)) return 'fish';
  if (hasKeyword(name, RED_MEAT)) return 'red';
  return null;
}

const isDryLegume = (name: string) => hasKeyword(name, DRY_LEGUMES) && !hasKeyword(name, NOT_DRY_LEGUME);

// ---------- Contrôle ----------

export function safetyIssues(recipe: SafetyRecipe, pantry: SafetyPantryItem[]): SafetyIssue[] {
  const steps = (recipe.instructions ?? []).map(String);
  const allSteps = steps.join(' \n ');
  const issues: SafetyIssue[] = [];
  const add = (code: SafetyCode, ingredient: string, message: string) => {
    if (!issues.some((issue) => issue.code === code && issue.ingredient === ingredient)) issues.push({ code, ingredient, message });
  };
  const stepsAbout = (name: string) => steps.filter((step) => mentions(step, name));

  let reheatNeeded: string | null = null;
  for (const ingredient of recipe.ingredients_used ?? []) {
    const item = ingredient.pantry_id ? pantry.find((p) => p.id === ingredient.pantry_id) : undefined;
    const name = ingredient.name;
    // Nom et quantité du garde-manger (« 1 boîte ») : indiquent une conserve ou un plat cuit
    const described = `${name} ${item?.name ?? ''} ${item?.quantity ?? ''} ${ingredient.unit ?? ''}`;
    const about = stepsAbout(name);
    const aboutText = about.join(' \n ');
    const leftover = item?.kind === 'dish' || hasKeyword(name, ['reste', 'leftover', 'sobra']);

    // Restes et riz déjà cuit : réchauffés à cœur
    if (leftover || hasKeyword(name, COOKED_RICE)) {
      reheatNeeded ??= name;
      continue;
    }
    const cooked = hasKeyword(described, COOKED) || hasKeyword(described, CANNED);

    // Légumineuses sèches : trempage et longue cuisson, sauf conserve précisée
    if (isDryLegume(name)) {
      const canned = cooked || hasKeyword(aboutText, CANNED);
      if (!canned) {
        const quick = hasKeyword(name, QUICK_LEGUMES);
        const minutes = longestMinutes(aboutText);
        const pressure = hasKeyword(aboutText, PRESSURE);
        const ok = quick
          ? minutes >= 15 && hasKeyword(aboutText, LIQUID)
          : hasKeyword(aboutText, SOAK) && (minutes >= 45 || (pressure && minutes >= 15));
        if (!ok) {
          add('dry_legumes', name, quick
            ? `« ${name} » : lentilles ou pois cassés secs, à cuire au moins 15 minutes dans l'eau (durée écrite), sinon préciser « en conserve » dans la liste et les étapes.`
            : `« ${name} » : légumineuses sèches, il faut un trempage (une nuit) puis une longue cuisson (au moins 45 minutes, durée écrite) ; sinon utiliser et écrire « en conserve » (égouttées, rincées) dans la liste et les étapes.`);
        }
      }
      continue;
    }

    // Féculents crus : cuits dans un liquide dans les étapes (liquide dans l'étape, ou porté à ébullition juste avant)
    if (isStarch(name) && !cooked) {
      const inLiquid = steps.some((step, i) => mentions(step, name)
        && (hasKeyword(step, LIQUID) || (hasKeyword(step, HEAT) && steps.slice(Math.max(0, i - 2), i).some((before) => hasKeyword(before, LIQUID)))));
      if (!inLiquid) {
        add('starch_not_cooked', name, `« ${name} » est cru : une étape doit le cuire (eau ou bouillon, durée et repère), avant de l'utiliser.`);
      }
      continue;
    }

    // Tubercules : cuits
    if (hasKeyword(name, TUBERS) && !cooked) {
      if (!about.some((step) => hasKeyword(step, HEAT))) add('not_cooked', name, `« ${name} » est cru : une étape doit le cuire (durée et repère, ex. tendre à la pointe du couteau).`);
      continue;
    }

    // Viande et poisson crus : cuisson, température à cœur au seuil et signe visible
    const protein = proteinOf(name);
    if (!protein || cooked) continue;
    // Cuit : une étape qui en parle, ou une étape suivante (« enfourne 20 minutes »), chauffe
    const first = steps.findIndex((step) => mentions(step, name));
    const heated = first >= 0 && steps.slice(first).some((step) => hasKeyword(step, HEAT));
    if (!heated) {
      if ((protein === 'fish' || protein === 'shellfish') && hasKeyword(allSteps, FROZEN_BEFORE)) continue;
      add(protein === 'fish' || protein === 'shellfish' ? 'raw_fish' : 'not_cooked', name, protein === 'fish' || protein === 'shellfish'
        ? `« ${name} » n'est pas cuit : le cuire (${PROTEIN_LABEL[protein]}), ou, pour un plat de poisson cru, n'utiliser qu'un poisson très frais préalablement congelé et l'écrire.`
        : `« ${name} » doit être cuit dans les étapes (${PROTEIN_LABEL[protein]}).`);
      continue;
    }
    const threshold = THRESHOLDS[protein];
    if (threshold !== null && !celsius(allSteps).some((t) => t >= threshold && t <= 100)) {
      add('core_temperature', name, `« ${name} » : écrire la température à cœur (${PROTEIN_LABEL[protein]}).`);
    }
    const signs = protein === 'fish' ? SIGNS_FISH : protein === 'shellfish' ? SIGNS_SHELLFISH : SIGNS_MEAT;
    if (!hasKeyword(allSteps, signs)) add('doneness_sign', name, `« ${name} » : ajouter un signe visible de cuisson (${PROTEIN_LABEL[protein]}).`);
  }

  if (reheatNeeded && !hasKeyword(allSteps, REHEAT)) {
    add('leftover_reheat', reheatNeeded, `« ${reheatNeeded} » (reste ou riz déjà cuit) : le réchauffer une seule fois, jusqu'à ce qu'il soit fumant à cœur, et servir aussitôt (l'écrire dans l'étape).`);
  }

  // Riz cuit pour la recette puis refroidi : vite, et au frais
  for (const ingredient of recipe.ingredients_used ?? []) {
    if (!hasKeyword(ingredient.name, ['riz', 'rice', 'arroz']) || hasKeyword(ingredient.name, COOKED_RICE)) continue;
    // « Rince à l'eau froide » n'est pas un refroidissement
    const withoutColdWater = (step: string) => normalizeText(step).replace(/eau froide|cold water|agua fria/g, '');
    const cooling = stepsAbout(ingredient.name).filter((step) => hasKeyword(withoutColdWater(step), COOLING));
    if (cooling.length > 0 && !cooling.some((step) => hasKeyword(step, FAST_COOLING))) {
      add('rice_cooling', ingredient.name, `« ${ingredient.name} » refroidi : l'étaler pour le refroidir vite et le mettre au réfrigérateur (jamais laissé tiède à température ambiante).`);
    }
  }
  return issues;
}

// ---------- Indications de feu (évaluation seulement : ce n'est pas un risque sanitaire) ----------

const HEAT_LEVEL = /\b(feu (tres )?(doux|moyen|vif|fort|moyen vif|moyen doux)|(low|medium|high|medium high|medium low) heat|fuego (muy )?(bajo|medio|alto|fuerte|lento|medio alto|medio bajo))\b/;
const VESSEL = ['poele', 'casserole', 'cocotte', 'wok', 'sauteuse', 'marmite', 'faitout', 'pan ', 'pot ', 'skillet', 'saucepan', 'sarten', 'olla', 'cazuela', 'cacerola'];
const OVEN = ['four ', 'enfourn', 'oven', 'horno', 'hornea'];
const CORE = ['coeur', 'core', 'interne', 'internal', 'interna', 'centro', 'center', 'centre', 'thickest', 'thermometre', 'thermometer', 'termometro', 'epais'];
const FRYING_OIL = ['friture', 'frying', 'deep fry', 'deep fried', 'freir en abundante', 'fritura'];

// °C donnés pour une cuisson sur le feu (« feu moyen (180 °C) ») : ni four, ni huile de friture, ni cuisson à cœur
export function stoveCelsius(recipe: SafetyRecipe): string[] {
  return (recipe.instructions ?? []).filter((step) => celsius(step).length > 0 && !hasKeyword(step, OVEN) && !hasKeyword(step, CORE) && !hasKeyword(step, FRYING_OIL)
    && !hasKeyword(step, [...SIGNS_MEAT, ...SIGNS_FISH]));
}

// Niveau de feu dans une étape sans cuisson (« mélange 1 minute à feu doux » dans une salade)
export function heatWithoutCooking(recipe: SafetyRecipe): string[] {
  const steps = recipe.instructions ?? [];
  return steps.filter((step, i) => {
    const normalized = normalizeText(step);
    if (!HEAT_LEVEL.test(normalized)) return false;
    const cooking = (text: string) => hasKeyword(text, HEAT) || hasKeyword(text, VESSEL);
    return !cooking(step) && !(i > 0 && cooking(steps[i - 1]));
  });
}

// Température à cœur pour un aliment qui n'est ni viande ni poisson crus (restes, légumes : signe visible seulement)
export function celsiusWithoutMeat(recipe: SafetyRecipe): boolean {
  const meat = (recipe.ingredients_used ?? []).some((i) => proteinOf(i.name) !== null && !hasKeyword(i.name, COOKED));
  if (meat) return false;
  return (recipe.instructions ?? []).some((step) => !hasKeyword(step, OVEN) && !hasKeyword(step, FRYING_OIL) && celsius(step).some((t) => t >= 55 && t <= 100));
}
