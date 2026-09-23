import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const CLARIFAI_PAT = Deno.env.get('CLARIFAI_PAT') || '';
// URL corrigée sans espace
const CLARIFAI_API_URL = 'https://api.clarifai.com/v2/users/clarifai/apps/main/models/food-item-recognition/versions/1d5fd481e0cf4826aa72ec3ff049e044/outputs';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const VALID_FOOD_TERMS = [
  'apple', 'pomme', 'banana', 'banane', 'orange', 'carrot', 'carotte',
  'tomato', 'tomate', 'potato', 'pomme de terre', 'onion', 'oignon',
  'garlic', 'ail', 'lemon', 'citron', 'lime', 'strawberry', 'fraise',
  'grape', 'raisin', 'pear', 'poire', 'peach', 'pêche', 'plum', 'prune',
  'cherry', 'cerise', 'mango', 'mangue', 'pineapple', 'ananas', 'watermelon',
  'pastèque', 'melon', 'cucumber', 'concombre', 'pepper', 'poivron', 'chili',
  'lettuce', 'laitue', 'spinach', 'épinard', 'broccoli', 'brocoli', 'cauliflower',
  'chou-fleur', 'cabbage', 'chou', 'eggplant', 'aubergine', 'zucchini', 'courgette',
  'mushroom', 'champignon', 'corn', 'maïs', 'peas', 'petits pois', 'beans', 'haricots',
  'chickpea', 'pois chiche', 'lentil', 'lentille', 'rice', 'riz', 'pasta', 'pâtes',
  'bread', 'pain', 'cheese', 'fromage', 'milk', 'lait', 'egg', 'oeuf', 'meat',
  'viande', 'chicken', 'poulet', 'beef', 'boeuf', 'fish', 'poisson', 'shrimp',
  'crevette', 'salmon', 'saumon', 'tuna', 'thon', 'yogurt', 'yaourt', 'butter',
  'beurre', 'oil', 'huile', 'vinegar', 'vinaigre', 'sugar', 'sucre', 'salt', 'sel',
  'pepper', 'poivre', 'spice', 'épice', 'herb', 'herbe', 'flour', 'farine',
  'chocolate', 'chocolat', 'coffee', 'café', 'tea', 'thé', 'juice', 'jus',
  'wine', 'vin', 'beer', 'bière', 'water', 'eau', 'soda', 'soda', 'nuts',
  'noix', 'almond', 'amande', 'walnut', 'noix', 'peanut', 'cacahuète', 'honey',
  'miel', 'jam', 'confiture', 'sauce', 'sauce', 'soup', 'soupe', 'salad',
  'salade', 'cake', 'gâteau', 'pie', 'tarte', 'cookie', 'biscuit', 'ice cream',
  'glace', 'pizza', 'burger', 'sandwich', 'taco', 'sushi', 'noodle', 'nouille',
  'rice', 'riz', 'curry', 'soup', 'soupe', 'stew', 'ragoût', 'grill', 'grillé'
];

interface AnalyzeImageRequest {
  image_base64: string;
}

interface ClarifaiConcept {
  id: string;
  name: string;
  value: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { image_base64 }: AnalyzeImageRequest = await req.json();

    if (!image_base64) {
      return new Response(
        JSON.stringify({ error: 'No image provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!CLARIFAI_PAT) {
      return new Response(
        JSON.stringify({ error: 'Clarifai PAT not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Appel API Clarifai avec PAT
    const response = await fetch(CLARIFAI_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${CLARIFAI_PAT}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: [
          {
            data: {
              image: {
                base64: image_base64,
              },
            },
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Clarifai error:', errorText);
      throw new Error(`Clarifai API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    const concepts: ClarifaiConcept[] = data.outputs?.[0]?.data?.concepts || [];
    
    const detectedIngredients = concepts
      .filter((concept: ClarifaiConcept) => concept.value > 0.7)
      .map((concept: ClarifaiConcept) => {
        const name = concept.name.toLowerCase();
        return name.charAt(0).toUpperCase() + name.slice(1);
      })
      .filter((name: string) => {
        const lowerName = name.toLowerCase();
        return VALID_FOOD_TERMS.some(term => 
          lowerName.includes(term) || term.includes(lowerName)
        );
      })
      .filter((value: string, index: number, self: string[]) => self.indexOf(value) === index)
      .slice(0, 8);

    return new Response(
      JSON.stringify({ 
        ingredients: detectedIngredients,
        raw_concepts: concepts.slice(0, 5).map((c: ClarifaiConcept) => ({ 
          name: c.name, 
          confidence: Math.round(c.value * 100) + '%' 
        }))
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error analyzing image:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to analyze image', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});