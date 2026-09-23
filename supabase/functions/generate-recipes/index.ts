import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY') || '';
const POLLINATIONS_API_KEY = Deno.env.get('POLLINATIONS_API_KEY') || '';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
// Modèle configurable par secret : les fournisseurs retirent régulièrement des modèles
const GROQ_MODEL = Deno.env.get('GROQ_MODEL') || 'openai/gpt-oss-120b';
// Les modèles gpt-oss raisonnent avant de répondre : on limite l'effort pour ne pas tronquer le JSON
const IS_REASONING_MODEL = GROQ_MODEL.includes('gpt-oss');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface GenerateRecipeRequest {
  ingredients: string[];
  preferences: {
    dietary: string[];
    difficulty: 'easy' | 'medium' | 'expert';
    maxCookTime?: number;
    mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    cuisine?: string;
    language: string;
  };
  generateImage?: boolean;
}

interface Recipe {
  title: string;
  description: string;
  difficulty: string;
  prep_time: number;
  cook_time: number;
  total_time: number;
  servings: number;
  meal_type: string;
  dietary_tags: string[];
  ingredients_used: Array<{
    name: string;
    quantity: string;
    unit: string;
  }>;
  ingredients_from_list: string[];
  missing_ingredients?: string[];
  instructions: string[];
  tips: string[];
  suggestion?: string;
  image_prompt: string;
  image_url?: string;
}

// Causes d'échec distinguées dans la réponse envoyée à l'app
type FailureReason = 'api_error' | 'invalid_json' | 'dietary_refusal';

type GenerationResult =
  | { ok: true; recipe: Recipe }
  | { ok: false; reason: FailureReason };

const FAILURE_MESSAGES: Record<string, Record<FailureReason, string>> = {
  'fr': {
    api_error: 'Le service de génération de recettes est momentanément indisponible. Réessayez dans quelques instants.',
    invalid_json: 'La réponse de l\'IA était illisible. Réessayez.',
    dietary_refusal: 'Impossible de créer une recette qui respecte vos régimes alimentaires avec ces ingrédients. Ajoutez des ingrédients ou retirez un régime.'
  },
  'en': {
    api_error: 'The recipe generation service is temporarily unavailable. Please try again in a moment.',
    invalid_json: 'The AI response could not be read. Please try again.',
    dietary_refusal: 'No recipe can respect your dietary restrictions with these ingredients. Add ingredients or remove a restriction.'
  },
  'es': {
    api_error: 'El servicio de generación de recetas no está disponible en este momento. Inténtalo de nuevo en unos instantes.',
    invalid_json: 'No se pudo leer la respuesta de la IA. Inténtalo de nuevo.',
    dietary_refusal: 'No es posible crear una receta que respete tus restricciones alimentarias con estos ingredientes. Añade ingredientes o quita una restricción.'
  }
};

const FAILURE_STATUS: Record<FailureReason, number> = {
  api_error: 502,
  invalid_json: 502,
  dietary_refusal: 422,
};

// Styles de cuisine par langue
const CUISINE_STYLES: Record<string, string[]> = {
  'fr': ['français', 'italien', 'asiatique', 'méditerranéen', 'rustique', 'gastronomique'],
  'en': ['french', 'italian', 'asian', 'mediterranean', 'rustic', 'gourmet'],
  'es': ['francés', 'italiano', 'asiático', 'mediterráneo', 'rústico', 'gourmet']
};

// Traductions pour les prompts
const TRANSLATIONS: Record<string, any> = {
  'fr': {
    mealTypes: {
      breakfast: 'petit-déjeuner',
      lunch: 'déjeuner',
      dinner: 'dîner',
      snack: 'goûter'
    },
    dietaryRules: {
      vegan: 'INTERDIT absolu: viande, poisson, fruits de mer, œufs, lait, fromage, beurre, crème, yaourt, miel, gélatine, caséine, blanc d\'œuf',
      vegetarian: 'INTERDIT absolu: viande, poisson, fruits de mer, crustacés (œufs et produits laitiers autorisés)',
      'gluten-free': 'INTERDIT absolu: blé, orge, seigle, épeautre, kamut, farine de blé, pâtes, pain, semoule, couscous, sauf si explicitement sans gluten',
      'dairy-free': 'INTERDIT absolu: lait de vache, fromage, beurre, crème, yaourt, lait en poudre, caséine, lactose, lait de chèvre/brebis',
      'low-carb': 'LIMITER: pain, pâtes, riz, pommes de terre, légumineuses, sucre, fruits sucrés (privilégier viandes, poissons, œufs, légumes verts, fromages)'
    },
    units: {
      mass: ['g', 'kg'],
      volume: ['ml', 'cl', 'l'],
      spoon: ['c. à soupe', 'c. à café'],
      unit: ['pièce', 'unité', 'tranche', 'gousse', 'feuille', 'pincée']
    }
  },
  'en': {
    mealTypes: {
      breakfast: 'breakfast',
      lunch: 'lunch',
      dinner: 'dinner',
      snack: 'snack'
    },
    dietaryRules: {
      vegan: 'STRICTLY FORBIDDEN: meat, fish, seafood, eggs, milk, cheese, butter, cream, yogurt, honey, gelatin, casein, egg white',
      vegetarian: 'STRICTLY FORBIDDEN: meat, fish, seafood, shellfish (eggs and dairy allowed)',
      'gluten-free': 'STRICTLY FORBIDDEN: wheat, barley, rye, spelt, kamut, wheat flour, pasta, bread, semolina, couscous unless explicitly gluten-free',
      'dairy-free': 'STRICTLY FORBIDDEN: cow milk, cheese, butter, cream, yogurt, milk powder, casein, lactose, goat/sheep milk',
      'low-carb': 'LIMIT: bread, pasta, rice, potatoes, legumes, sugar, sweet fruits (prioritize meats, fish, eggs, green vegetables, cheeses)'
    },
    units: {
      mass: ['g', 'kg'],
      volume: ['ml', 'cl', 'l'],
      spoon: ['tbsp', 'tsp'],
      unit: ['piece', 'unit', 'slice', 'clove', 'leaf', 'pinch']
    }
  },
  'es': {
    mealTypes: {
      breakfast: 'desayuno',
      lunch: 'almuerzo',
      dinner: 'cena',
      snack: 'merienda'
    },
    dietaryRules: {
      vegan: 'ESTRICTAMENTE PROHIBIDO: carne, pescado, mariscos, huevos, leche, queso, mantequilla, crema, yogur, miel, gelatina, caseína, clara de huevo',
      vegetarian: 'ESTRICTAMENTE PROHIBIDO: carne, pescado, mariscos, crustáceos (huevos y lácteos permitidos)',
      'gluten-free': 'ESTRICTAMENTE PROHIBIDO: trigo, cebada, centeno, espelta, harina de trigo, pasta, pan, sémola, cuscús a menos que sea explícitamente sin gluten',
      'dairy-free': 'ESTRICTAMENTE PROHIBIDO: leche de vaca, queso, mantequilla, crema, yogur, leche en polvo, caseína, lactosa, leche de cabra/oveja',
      'low-carb': 'LIMITAR: pan, pasta, arroz, patatas, legumbres, azúcar, frutas dulces (priorizar carnes, pescados, huevos, verduras, quesos)'
    },
    units: {
      mass: ['g', 'kg'],
      volume: ['ml', 'cl', 'l'],
      spoon: ['cda', 'cdta'],
      unit: ['pieza', 'unidad', 'rebanada', 'diente', 'hoja', 'pizca']
    }
  }
};

function getTranslation(key: string, lang: string, subKey?: string): any {
  const langCode = lang.substring(0, 2).toLowerCase();
  const trans = TRANSLATIONS[langCode] || TRANSLATIONS['en'];
  if (subKey) {
    return trans[key]?.[subKey] || TRANSLATIONS['en'][key]?.[subKey];
  }
  return trans[key] || TRANSLATIONS['en'][key];
}

function generatePollinationsUrl(prompt: string): string {
  const encodedPrompt = encodeURIComponent(prompt);
  const seed = Math.floor(Math.random() * 2147483647);
  return `https://gen.pollinations.ai/image/${encodedPrompt}?model=flux&width=1024&height=1024&seed=${seed}&enhance=true&key=${POLLINATIONS_API_KEY}`;
}

function buildDietaryRules(dietary: string[], language: string): string {
  const rules: string[] = [];
  const langRules = getTranslation('dietaryRules', language);
  
  for (const diet of dietary) {
    const rule = langRules[diet.toLowerCase()];
    if (rule) rules.push(rule);
  }
  
  return rules.join('\n') || (language === 'fr' ? 'Aucune restriction diététique' : 'No dietary restrictions');
}

// Minuscules, sans accents ni espaces superflus : "Œufs " et "oeufs" se comparent correctement
function normalizeName(name: string): string {
  return name.toLowerCase().replace(/œ/g, 'oe').normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

function getMealTypeName(mealType: string, language: string): string {
  const mealTypes = getTranslation('mealTypes', language);
  return mealTypes[mealType] || mealType;
}

// Le type de repas est une préférence : ces descriptions orientent la recette sans l'interdire
function buildMealTypePreference(mealType: string, language: string): string {
  const rules: Record<string, Record<string, string>> = {
    'fr': {
      breakfast: 'Repas du matin. Idéalement : rapide (15-20 min), léger, énergisant, compatible café/thé/jus. De préférence éviter : plats lourds, viandes grasses, friture.',
      lunch: 'Repas de midi. Idéalement : équilibré, rassasiant, peut être préparé à l\'avance. De préférence : protéine + légume + féculent.',
      dinner: 'Repas du soir. Idéalement : plus léger que le déjeuner, digeste, pas trop épicé ni gras. De préférence éviter : friture, sauces lourdes, café.',
      snack: 'Encas rapide. Idéalement : très rapide (5-10 min), sucré OU salé léger, peu ou pas de cuisson. Par exemple : fruit, yaourt, tartine, smoothie.'
    },
    'en': {
      breakfast: 'Morning meal. Ideally: quick (15-20 min), light, energizing, compatible with coffee/tea/juice. Preferably avoid: heavy dishes, fatty meats, fried food.',
      lunch: 'Midday meal. Ideally: balanced, filling, can be prepared ahead. Preferably: protein + vegetable + carb.',
      dinner: 'Evening meal. Ideally: lighter than lunch, easy to digest, not too spicy or fatty. Preferably avoid: fried food, heavy sauces, coffee.',
      snack: 'Quick bite. Ideally: very quick (5-10 min), sweet OR light savory, little or no cooking. For example: fruit, yogurt, toast, smoothie.'
    },
    'es': {
      breakfast: 'Comida de la mañana. Idealmente: rápida (15-20 min), ligera, energizante, compatible con café/té/zumo. Preferiblemente evitar: platos pesados, carnes grasas, frituras.',
      lunch: 'Comida del mediodía. Idealmente: equilibrada, saciante, puede prepararse con antelación. Preferiblemente: proteína + verdura + carbohidrato.',
      dinner: 'Comida de la noche. Idealmente: más ligera que el almuerzo, fácil de digerir, no muy picante ni grasa. Preferiblemente evitar: frituras, salsas pesadas, café.',
      snack: 'Bocado rápido. Idealmente: muy rápido (5-10 min), dulce O salado ligero, poca o ninguna cocción. Por ejemplo: fruta, yogur, tostada, batido.'
    }
  };
  
  const langCode = language.substring(0, 2).toLowerCase();
  return rules[langCode]?.[mealType] || rules['en'][mealType];
}

// Nouvelle fonction pour générer des variations uniques
function generateRecipeVariation(index: number, total: number, ingredients: string[], language: string): string {
  const langCode = language.substring(0, 2).toLowerCase();
  const styles = CUISINE_STYLES[langCode] || CUISINE_STYLES['en'];
  
  const techniques: Record<string, string[]> = {
    'fr': ['sauté', 'mijoté', 'grillé', 'braisé', 'poêlé', 'rôti', 'en cocotte', 'à la plancha', 'vapeur', 'en papillote'],
    'en': ['sautéed', 'braised', 'grilled', 'roasted', 'pan-seared', 'slow-cooked', 'steamed', 'en papillote', 'stir-fried', 'baked'],
    'es': ['salteado', 'estofado', 'a la parrilla', 'asado', 'salteado en sartén', 'cocido lento', 'al vapor', 'en papillote', 'salteado', 'horneado']
  };
  
  const textures: Record<string, string[]> = {
    'fr': ['crémeux et onctueux', 'croquant et léger', 'fondant et moelleux', 'croustillant et doré', 'tendre et juteux', 'aéré et délicat'],
    'en': ['creamy and smooth', 'crispy and light', 'tender and moist', 'crunchy and golden', 'juicy and succulent', 'airy and delicate'],
    'es': ['cremoso y suave', 'crujiente y ligero', 'tierno y jugoso', 'crujiente y dorado', 'jugoso y suculento', 'aireado y delicado']
  };
  
  const techs = techniques[langCode] || techniques['en'];
  const texs = textures[langCode] || textures['en'];
  
  // Rotation des styles selon l'index
  const style = styles[index % styles.length];
  const technique = techs[index % techs.length];
  const texture = texs[index % texs.length];
  
  if (langCode === 'fr') {
    return `
VARIATION ${index + 1}/${total} - OBLIGATOIRE:
- Style culinaire: ${style}
- Technique de cuisson: ${technique}
- Texture finale: ${texture}
- Le titre doit refléter cette variation (ex: "Poulet ${technique}" ou "${style} de poulet")
- Les instructions doivent détailler la technique ${technique} avec temps et températures précis`;
  } else if (langCode === 'es') {
    return `
VARIACIÓN ${index + 1}/${total} - OBLIGATORIO:
- Estilo culinario: ${style}
- Técnica de cocción: ${technique}
- Textura final: ${texture}
- El título debe reflejar esta variación (ej: "Pollo ${technique}" o "${style} de pollo")
- Las instrucciones deben detallar la técnica ${technique} con tiempos y temperaturas precisos`;
  } else {
    return `
VARIATION ${index + 1}/${total} - MANDATORY:
- Culinary style: ${style}
- Cooking technique: ${technique}
- Final texture: ${texture}
- Title must reflect this variation (e.g., "${technique} Chicken" or "${style} Chicken")
- Instructions must detail the ${technique} technique with precise times and temperatures`;
  }
}

async function generateRecipeWithGroq(
  ingredients: string[], 
  preferences: any, 
  recipeIndex: number,
  totalRecipes: number
): Promise<GenerationResult> {
  const difficulty = preferences.difficulty || 'easy';
  const maxTime = preferences.maxCookTime || 60;
  const dietary: string[] = preferences.dietary || [];
  const hasDietary = dietary.length > 0;
  const mealType = preferences.mealType || 'lunch';
  const language = preferences.language || 'français';

  const dietaryRules = buildDietaryRules(dietary, language);
  const mealName = getMealTypeName(mealType, language);
  const mealPreference = buildMealTypePreference(mealType, language);
  const variationRules = totalRecipes > 1 ? generateRecipeVariation(recipeIndex, totalRecipes, ingredients, language) : '';

  // Seuls les régimes alimentaires autorisent un refus ; sans régime, le modèle doit toujours proposer une recette
  const refusalRule = hasDietary
    ? `SEUL CAS DE REFUS: si les régimes alimentaires ci-dessus empêchent d'utiliser le moindre ingrédient fourni, retourne UNIQUEMENT {"error": "dietary_impossible", "reason": "explication courte"}. Aucun autre motif de refus n'est accepté.`
    : `Tu dois TOUJOURS retourner une recette. Ne retourne jamais d'erreur.`;

  const systemPrompt = `Tu es un chef expert anti-gaspi. Tu crées des recettes précises dans la langue: ${language}.

RÈGLES ABSOLUES DE SÉCURITÉ ALIMENTAIRE (les seules règles strictes):
${dietaryRules}

PRÉFÉRENCE DE TYPE DE REPAS (${mealName}) — c'est une préférence, PAS une règle:
${mealPreference}
- Si les ingrédients se prêtent mal à ce type de repas, propose QUAND MÊME la recette la plus adaptée possible, en complétant si besoin avec des ingrédients courants listés dans "missing_ingredients".
- Dans ce cas, ajoute le champ "suggestion": une phrase courte, dans la langue ${language}, qui indique le moment où la recette est idéale (ex: "Idéal aussi en petit-déjeuner"). Sinon, n'ajoute pas ce champ.
- Ne refuse JAMAIS une recette à cause du type de repas.
${variationRules}

RÈGLES DE FORMATAGE STRICT:
- "quantity": UNIQUEMENT le nombre/chiffre (ex: "500", "2", "1/2", "3.5", "1")
- "unit": unité standard abrégée: g, kg, ml, cl, l, c. à soupe, c. à café, pièce, tranche, gousse, feuille, pincée
- JAMAIS de répétition entre quantity et unit
- JAMAIS d'unité dans le champ quantity

RÈGLES INSTRUCTIONS - INTERDIT (trop générique):
- "Ajoutez [ingrédient] et faites cuire"
- "Faites cuire jusqu'à ce que ce soit cuit"
- "Servez avec..."
- "Assaisonnez avec sel et poivre"

RÈGLES INSTRUCTIONS - OBLIGATOIRE:
- Technique précise avec température (ex: "À feu vif pendant 3 minutes", "Au four à 180°C pendant 25 minutes")
- Indicateur sensoriel précis (ex: "Jusqu'à ce que le poulet soit doré et que la viande ne soit plus rose à cœur", "Jusqu'à ce que le riz soit tendre et ait absorbé tout le liquide")
- Action spécifique (ex: "Faites revenir", "Faites dorer", "Mijotez", "Sautez", "Pochez", "Grillez")
- Temps exact ou test de cuisson précis

${refusalRule}`;

  const userPrompt = `Ingrédients disponibles: ${ingredients.join(', ')}

PARAMÈTRES:
- Difficulté: ${difficulty}
- Type de repas (préférence): ${mealName}
- Temps max: ${maxTime} minutes
- Langue: ${language}

FORMAT JSON STRICT:
{
  "title": "Nom créatif et unique",
  "description": "Description appétissante mentionnant le style et la texture",
  "difficulty": "${difficulty}",
  "prep_time": 15,
  "cook_time": 25,
  "total_time": 40,
  "servings": 4,
  "dietary_tags": ["tag1", "tag2"],
  "ingredients_used": [
    { "name": "...", "quantity": "500", "unit": "g" }
  ],
  "ingredients_from_list": ["ingrédient1", "ingrédient2"],
  "missing_ingredients": ["sel", "poivre"],
  "instructions": [
    "Étape 1: Action précise avec température/temps",
    "Étape 2: Action précise avec indicateur sensoriel",
    "..."
  ],
  "tips": ["Astuce pratique spécifique à cette recette"],
  "suggestion": "(optionnel) Idéal aussi en petit-déjeuner",
  "image_prompt": "Professional food photography, [style] [plat], [texture], studio lighting, appetizing, 4k"
}

IMPORTANT:
- Respecte STRICTEMENT les restrictions diététiques ; le type de repas est seulement une préférence
- Le titre doit être UNIQUE et refléter le style/technique
- Les instructions doivent être PRÉCISES et ACTIONNABLES`;

  let content: string;
  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.8, // Augmenté pour plus de créativité
        max_tokens: IS_REASONING_MODEL ? 4096 : 2048, // le raisonnement compte dans la limite
        ...(IS_REASONING_MODEL && { reasoning_effort: 'low' }),
        response_format: { type: 'json_object' }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Groq API error ${response.status}:`, errorText);
      // En mode json_object, Groq renvoie une 400 "json_validate_failed" quand le modèle produit un JSON invalide
      return { ok: false, reason: errorText.includes('json_validate_failed') ? 'invalid_json' : 'api_error' };
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    if (!choice?.message?.content || choice.finish_reason === 'length') {
      console.error('Groq response empty or truncated:', choice?.finish_reason);
      return { ok: false, reason: 'invalid_json' };
    }
    content = choice.message.content;
  } catch (error) {
    console.error('Error calling Groq:', error);
    return { ok: false, reason: 'api_error' };
  }

  let recipeData: any;
  try {
    recipeData = JSON.parse(content);
  } catch {
    console.error('Unreadable JSON from Groq:', content.slice(0, 500));
    return { ok: false, reason: 'invalid_json' };
  }

  if (recipeData.error) {
    console.log('Recipe refused by the model:', content);
    // Un refus n'est légitime que si un régime est sélectionné ; sinon la réponse est inexploitable
    return { ok: false, reason: hasDietary ? 'dietary_refusal' : 'invalid_json' };
  }

  const cleanIngredients = (recipeData.ingredients_used || []).map((ing: any) => ({
    name: ing.name || 'Ingrédient',
    quantity: String(ing.quantity || '1').replace(/[a-zA-ZÀ-ÿ\s]/g, '').trim() || '1',
    unit: (ing.unit || 'pièce').toString().trim()
  }));

  // Le modèle range parfois des ingrédients ajoutés dans ingredients_from_list :
  // on recalcule le tri à partir de la liste réellement fournie par l'utilisateur
  const provided = ingredients.map(normalizeName);
  const isProvided = (name: string) => {
    const n = normalizeName(name);
    return provided.some((p) => n.includes(p) || p.includes(n));
  };
  const usedNames = cleanIngredients.map((i: { name: string }) => i.name);
  const fromList = usedNames.filter(isProvided);
  const missing = [...usedNames, ...(recipeData.missing_ingredients || [])]
    .filter((name: unknown): name is string => typeof name === 'string' && name.trim() !== '')
    .filter((name: string) => !isProvided(name))
    .filter((name: string, i: number, all: string[]) =>
      all.findIndex((other) => normalizeName(other) === normalizeName(name)) === i);

  const suggestion = typeof recipeData.suggestion === 'string' ? recipeData.suggestion.trim() : '';

  const recipe: Recipe = {
    title: recipeData.title || 'Recette',
    description: recipeData.description || '',
    difficulty: recipeData.difficulty || difficulty,
    prep_time: recipeData.prep_time || 15,
    cook_time: recipeData.cook_time || 20,
    total_time: recipeData.total_time || 35,
    servings: recipeData.servings || 2,
    meal_type: mealType,
    dietary_tags: recipeData.dietary_tags || dietary,
    ingredients_used: cleanIngredients,
    ingredients_from_list: fromList,
    missing_ingredients: missing,
    instructions: recipeData.instructions || [],
    tips: recipeData.tips || [],
    ...(suggestion && { suggestion }),
    image_prompt: recipeData.image_prompt || `Professional food photography, ${recipeData.title}, appetizing`,
  };
  return { ok: true, recipe };
}

function generateFallbackRecipe(ingredients: string[], preferences: any): Recipe {
  const language = preferences?.language || 'fr';
  const mealType = preferences?.mealType || 'lunch';
  
  const titles: Record<string, any> = {
    'fr': {
      breakfast: 'Petit-déjeuner express',
      lunch: 'Déjeuner rapide',
      dinner: 'Dîner léger',
      snack: 'Goûter simple'
    },
    'en': {
      breakfast: 'Quick breakfast',
      lunch: 'Quick lunch',
      dinner: 'Light dinner',
      snack: 'Simple snack'
    },
    'es': {
      breakfast: 'Desayuno rápido',
      lunch: 'Almuerzo rápido',
      dinner: 'Cena ligera',
      snack: 'Merienda simple'
    }
  };
  
  const lang = language.substring(0, 2).toLowerCase();
  
  return {
    title: titles[lang]?.[mealType] || titles['en'][mealType],
    description: language === 'fr' ? 'Recette simple anti-gaspi' : 'Simple anti-waste recipe',
    difficulty: preferences?.difficulty || 'easy',
    prep_time: 10,
    cook_time: 15,
    total_time: 25,
    servings: 2,
    meal_type: mealType,
    dietary_tags: preferences?.dietary || [],
    ingredients_used: ingredients.slice(0, 3).map(name => ({ 
      name, 
      quantity: '1', 
      unit: lang === 'fr' ? 'pièce' : lang === 'es' ? 'pieza' : 'piece'
    })),
    ingredients_from_list: ingredients.slice(0, 3),
    missing_ingredients: [],
    instructions: language === 'fr' 
      ? ['Préparer les ingrédients', 'Cuire selon votre préférence', 'Servir']
      : language === 'es'
      ? ['Preparar los ingredientes', 'Cocinar según su preferencia', 'Servir']
      : ['Prepare ingredients', 'Cook to your preference', 'Serve'],
    tips: language === 'fr' ? ['Bonne appétit !'] : language === 'es' ? ['¡Buen provecho!'] : ['Enjoy!'],
    image_prompt: `Professional food photography, simple homemade dish, appetizing, warm lighting`
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { ingredients, preferences, generateImage }: GenerateRecipeRequest = await req.json();

    if (!ingredients || ingredients.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Aucun ingrédient fourni' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!preferences?.mealType) {
      return new Response(
        JSON.stringify({ error: 'Type de repas requis (mealType)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!preferences?.language) {
      return new Response(
        JSON.stringify({ error: 'Langue requise (language)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Déterminer le nombre de recettes selon les ingrédients
    const numIngredients = ingredients.length;
    let numRecipes: number;
    
    if (numIngredients <= 2) {
      numRecipes = 1;
    } else if (numIngredients <= 5) {
      numRecipes = 2;
    } else {
      numRecipes = 3;
    }

    const dietary = preferences.dietary || [];
    const recipes: Recipe[] = [];
    const failures: FailureReason[] = [];
    let attempts = 0;
    const maxAttempts = numRecipes * 2;

    while (recipes.length < numRecipes && attempts < maxAttempts) {
      attempts++;

      const result = await generateRecipeWithGroq(
        ingredients,
        preferences,
        recipes.length,
        numRecipes
      );

      if (!result.ok) {
        failures.push(result.reason);
      } else if (checkForbiddenIngredients(result.recipe, dietary)) {
        // Ne peut se produire que si un régime est sélectionné
        failures.push('dietary_refusal');
      } else {
        const recipe = result.recipe;
        if (generateImage !== false && POLLINATIONS_API_KEY && recipe.image_prompt) {
          recipe.image_url = generatePollinationsUrl(recipe.image_prompt);
        }
        recipes.push(recipe);
      }

      if (recipes.length < numRecipes && attempts < maxAttempts) await new Promise(r => setTimeout(r, 500));
    }

    if (recipes.length === 0) {
      // Le message sur les régimes n'est utilisé que si un régime est sélectionné
      const reason: FailureReason =
        dietary.length > 0 && failures.includes('dietary_refusal') ? 'dietary_refusal'
        : failures.includes('api_error') ? 'api_error'
        : 'invalid_json';
      const langCode = preferences.language.substring(0, 2).toLowerCase();
      const messages = FAILURE_MESSAGES[langCode] || FAILURE_MESSAGES['en'];

      console.error('No recipe generated. Failures:', failures.join(', '));
      return new Response(
        JSON.stringify({ error: reason, message: messages[reason] }),
        { status: FAILURE_STATUS[reason], headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ recipes, totalGenerated: recipes.length, requested: numRecipes }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating recipes:', error);
    return new Response(
      JSON.stringify({ error: 'Erreur lors de la génération', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function checkForbiddenIngredients(recipe: Recipe, dietary: string[]): boolean {
  const allText = [
    recipe.title,
    recipe.description,
    ...recipe.ingredients_used.map(i => i.name),
    ...recipe.instructions
  ].join(' ').toLowerCase();
  
  const forbiddenPatterns: Record<string, string[]> = {
    'vegan': ['chicken', 'beef', 'pork', 'meat', 'fish', 'salmon', 'tuna', 'egg', 'milk', 'cheese', 'butter', 'cream', 'yogurt', 'honey', 'gelatin', 'poulet', 'boeuf', 'porc', 'viande', 'poisson', 'saumon', 'thon', 'œuf', 'lait', 'fromage', 'beurre', 'crème', 'yaourt', 'miel', 'gélatine'],
    'vegetarian': ['chicken', 'beef', 'pork', 'meat', 'fish', 'salmon', 'tuna', 'seafood', 'shellfish', 'poulet', 'boeuf', 'porc', 'viande', 'poisson', 'saumon', 'thon', 'fruit de mer', 'crustacé'],
    'gluten-free': ['wheat', 'barley', 'rye', 'spelt', 'flour', 'pasta', 'bread', 'couscous', 'semolina', 'blé', 'orge', 'seigle', 'épeautre', 'farine', 'pâte', 'pain', 'semoule'],
    'dairy-free': ['milk', 'cheese', 'butter', 'cream', 'yogurt', 'lait', 'fromage', 'beurre', 'crème', 'yaourt']
  };
  
  for (const restriction of dietary) {
    const patterns = forbiddenPatterns[restriction.toLowerCase()];
    if (patterns) {
      for (const pattern of patterns) {
        if (allText.includes(pattern)) {
          console.log(`Forbidden ingredient found for ${restriction}: ${pattern}`);
          return true;
        }
      }
    }
  }
  
  return false;
}