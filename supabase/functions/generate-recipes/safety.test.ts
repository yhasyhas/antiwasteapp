import { assertEquals } from 'jsr:@std/assert@1';
import { celsiusWithoutMeat, heatWithoutCooking, longestMinutes, ovenWithoutTemperature, type SafetyPantryItem, safetyIssues, stoveCelsius, withoutOvenHeatLevel } from './safety.ts';

const pantry: SafetyPantryItem[] = [
  { id: 'rice', name: 'Riz', quantity: '1 kg', kind: 'ingredient' },
  { id: 'chicken', name: 'Cuisses de poulet', quantity: '4', kind: 'ingredient' },
  { id: 'chickpeas', name: 'Pois chiches', quantity: '400 g', kind: 'ingredient' },
  { id: 'tajine', name: 'Tajine de poulet', quantity: '2 portions', kind: 'dish' },
  { id: 'fish', name: 'Dorade', quantity: '2', kind: 'ingredient' },
];
const recipe = (ingredients: [string, string | null][], instructions: string[]) => ({
  title: 'Recette',
  ingredients_used: ingredients.map(([name, pantry_id]) => ({ name, quantity: '1', unit: '', pantry_id })),
  instructions,
});
const codes = (r: ReturnType<typeof recipe>) => safetyIssues(r, pantry).map((issue) => issue.code);

Deno.test('safetyIssues : riz cru du garde-manger jamais cuit (riz sauté), puis cuit dans l\'eau', () => {
  assertEquals(codes(recipe([['Riz', 'rice']], ['Fais chauffer 1 cuillère d\'huile dans le wok.', 'Ajoute les 200 g de riz et fais sauter 3 minutes.'])), ['starch_not_cooked']);
  assertEquals(codes(recipe([['Riz', 'rice']], ['Rince les 200 g de riz et cuis-les dans 400 ml d\'eau 12 minutes, jusqu\'à absorption.', 'Fais sauter le riz 3 minutes à feu vif.'])), []);
  // Riz ajouté à un bouillon porté à ébullition à l'étape précédente
  assertEquals(codes(recipe([['Riz', 'rice']], ['Porte 800 ml d\'eau à ébullition.', 'Ajoute le riz et cuis 15 minutes à feu moyen.'])), []);
});

Deno.test('safetyIssues : légumineuses sèches sans trempage, sauf conserve précisée ou trempage et longue cuisson', () => {
  assertEquals(codes(recipe([['Pois chiches', 'chickpeas']], ['Ajoute les pois chiches et cuis 10 minutes à feu moyen.'])), ['dry_legumes']);
  assertEquals(codes(recipe([['Pois chiches', 'chickpeas']], ['Égoutte et rince les 400 g de pois chiches en conserve.', 'Ajoute-les et cuis 10 minutes.'])), []);
  assertEquals(codes(recipe([['Pois chiches', 'chickpeas']], ['La veille, fais tremper les pois chiches.', 'Cuis les pois chiches 1 h 30 à feu doux dans 2 l d\'eau.'])), []);
  // Le temps de trempage n'est pas une cuisson : 4 h de trempage puis 20 minutes, insuffisant
  assertEquals(codes(recipe([['Pois chiches', 'chickpeas']], ['Fais tremper les pois chiches 4 h.', 'Cuis les pois chiches 20 minutes dans 1 l d’eau.'])), ['dry_legumes']);
  assertEquals(codes(recipe([['Lentilles corail', null]], ['Cuis les lentilles corail 20 minutes dans 600 ml d\'eau.'])), []);
  // Haricots verts : pas des légumineuses sèches
  assertEquals(codes(recipe([['Haricots verts', null]], ['Fais blanchir les haricots verts 4 minutes.'])), []);
});

Deno.test('safetyIssues : viande crue, température à cœur au seuil et signe visible', () => {
  assertEquals(codes(recipe([['Cuisses de poulet', 'chicken']], ['Fais dorer le poulet 25 minutes à feu moyen.'])), ['core_temperature', 'doneness_sign']);
  assertEquals(codes(recipe([['Cuisses de poulet', 'chicken']], ['Fais dorer le poulet 25 minutes à feu moyen, jusqu\'à ce que le jus soit clair (74 °C à cœur).'])), []);
  // Porc sous le seuil
  assertEquals(codes(recipe([['Filet de porc', null]], ['Saisis le porc 8 minutes, jusqu\'à 60 °C à cœur et un jus clair.'])), ['core_temperature']);
  // « haché » ou « molida » sans viande : pas de la viande hachée ; avec une viande : 71 °C
  assertEquals(codes(recipe([['Cúrcuma molida', null], ['Persil haché', null]], ['Añade la cúrcuma y el perejil.'])), []);
  assertEquals(codes(recipe([['Agneau haché', null]], ['Fais revenir l\'agneau 8 minutes, jusqu\'à 65 °C à cœur et plus rosé au centre.'])), ['core_temperature']);
  // Bouillon de poulet : pas de la viande crue
  assertEquals(codes(recipe([['Bouillon de poulet', null]], ['Verse le bouillon de poulet et laisse mijoter 10 minutes.'])), []);
  // Cuisson au four dans une étape qui ne nomme pas la viande
  assertEquals(codes(recipe([['Dorade', 'fish']], ['Pose la dorade dans un plat.', 'Enfourne 20 minutes à 200 °C, jusqu\'à ce que la chair soit opaque et atteigne 63 °C à cœur.'])), []);
});

Deno.test('safetyIssues : ingrédient au pluriel dans la liste, au singulier dans les étapes', () => {
  assertEquals(codes(recipe([['Ignames', null]], ['Épluche l\'igname et fais-la bouillir 20 minutes, jusqu\'à ce qu\'elle soit tendre.'])), []);
  assertEquals(codes(recipe([['Ignames', null]], ['Épluche l\'igname et coupe-la en dés.'])), ['not_cooked']);
});

Deno.test('safetyIssues : fausses alertes relevées par l\'évaluation des régions', () => {
  // Nouilles cuites dans l'eau portée à ébullition quatre étapes plus tôt (soupe)
  assertEquals(codes(recipe([['Fideos de trigo', null]], ['Lleva 800 ml de agua a ebullición.', 'Corta la col.', 'Pica la cebolleta.', 'Añade la salsa de soja.', 'Añade los fideos y cocina 4 minutos, hasta que estén al dente.'])), []);
  // Plantain râpé dans des galettes, frites dans une étape qui ne le nomme pas
  assertEquals(codes(recipe([['Bananes plantains', null]], ['Râpe les 3 plantains et mélange-les à la farine.', 'Fais frire les galettes 4 minutes de chaque côté, jusqu\'à ce qu\'elles soient dorées.'])), []);
  // « pierda el color rosado » : signe visible
  assertEquals(codes(recipe([['Cordero picado', null]], ['Dora el cordero 6 minutos, hasta que pierda el color rosado y alcance 71 °C.'])), []);
});

Deno.test('safetyIssues : signes visibles formulés librement, lentilles cuites dans l\'eau versée avant', () => {
  assertEquals(codes(recipe([['Agneau haché', null]], ['Mélange l\'agneau et les herbes, forme les köfte.', 'Cuis les köfte 4 minutes de chaque côté, jusqu\'à 71 °C à cœur (les jus doivent être clairs).'])), []);
  assertEquals(codes(recipe([['Cordero picado', null]], ['Cocina el cordero 6 minutos, hasta que la carne pierda su color rosado y alcance 71 °C.'])), []);
  assertEquals(codes(recipe([['Chicken thighs', null]], ['Simmer the chicken 12 minutes, until the internal temperature reaches 74 °C and the juices are clear.'])), []);
  // Sans signe : toujours signalé
  assertEquals(codes(recipe([['Cordero picado', null]], ['Cocina el cordero 6 minutos, hasta que esté bien cocido y alcance 71 °C.'])), ['doneness_sign']);
  assertEquals(codes(recipe([['Lentejas rojas', null]], ['Agrega las lentejas rojas y revuelve 2 minutos.', 'Vierte 1,5 l de agua y lleva a ebullición.', 'Cuece 20 minutos, hasta que las lentejas estén tiernas.'])), []);
});

Deno.test('safetyIssues : poisson cru seulement s\'il a été congelé avant', () => {
  assertEquals(codes(recipe([['Dorade', 'fish']], ['Coupe la dorade en dés et arrose de citron vert 15 minutes.'])), ['raw_fish']);
  assertEquals(codes(recipe([['Dorade', 'fish']], ['Utilise une dorade très fraîche, préalablement congelée 7 jours.', 'Coupe la dorade en dés et arrose de citron vert.'])), []);
});

Deno.test('safetyIssues : restes réchauffés à cœur, riz cuit refroidi vite', () => {
  assertEquals(codes(recipe([['Tajine de poulet', 'tajine']], ['Réchauffe le tajine 5 minutes à la poêle.'])), ['leftover_reheat']);
  assertEquals(codes(recipe([['Tajine de poulet', 'tajine']], ['Réchauffe le tajine 5 minutes à la poêle, jusqu\'à ce qu\'il soit fumant à cœur.'])), []);
  assertEquals(codes(recipe([['Riz cuit', null]], ['Fais sauter le riz cuit 4 minutes.'])), ['leftover_reheat']);
  assertEquals(codes(recipe([['Tajine de poulet', 'tajine']], ['Réchauffe le tajine 3 minutes, jusqu’à une température interne de 74 °C.'])), []);
  assertEquals(codes(recipe([['Riz', 'rice']], ['Cuis le riz 12 minutes dans 400 ml d\'eau.', 'Laisse refroidir le riz à température ambiante.'])), ['rice_cooling']);
  assertEquals(codes(recipe([['Riz', 'rice']], ['Rince le riz à l\'eau froide puis cuis-le 12 minutes dans 400 ml d\'eau.', 'Étale le riz sur une plaque pour le refroidir vite, puis mets-le au réfrigérateur.'])), []);
});

Deno.test('indications de feu : °C sur le feu, feu sans cuisson, °C hors viande', () => {
  const stove = recipe([['Oignon', null]], ['Fais revenir l\'oignon à feu moyen (180 °C) 5 minutes.', 'Enfourne à 200 °C pour 10 minutes.']);
  assertEquals(stoveCelsius(stove).length, 1);
  const salad = recipe([['Tomates', null]], ['Coupe les tomates.', 'Mélange 1 minute à feu doux avec la vinaigrette.']);
  assertEquals(heatWithoutCooking(salad).length, 1);
  const pan = recipe([['Oignon', null]], ['Fais chauffer l\'huile dans une poêle.', 'Baisse à feu doux et ajoute l\'oignon.']);
  assertEquals(heatWithoutCooking(pan).length, 0);
  assertEquals(celsiusWithoutMeat(recipe([['Tajine de poulet', 'tajine']], ['Réchauffe jusqu\'à 75 °C à cœur.'])), false);
  assertEquals(celsiusWithoutMeat(recipe([['Riz cuit', null]], ['Réchauffe le riz jusqu\'à 75 °C.'])), true);
});

Deno.test('longestMinutes : plages, heures et minutes', () => {
  assertEquals(longestMinutes('Cuis 10 à 12 minutes'), 12);
  assertEquals(longestMinutes('Mijote 1 h 30 à feu doux'), 90);
  assertEquals(longestMinutes('Simmer 45 min'), 45);
  assertEquals(longestMinutes('Coupe 2 tomates'), 0);
});

// Garde-manger en français, recette en anglais (générations du 02/10 : recettes avec viande et poisson écartées à tort)
const frenchPantry: SafetyPantryItem[] = [
  { id: 'potato', name: 'pomme de terre', quantity: '2', kind: 'ingredient' },
  { id: 'fish', name: 'poisson', quantity: '2', kind: 'ingredient' },
  { id: 'beef', name: 'bœuf', quantity: '2 morceaux', kind: 'ingredient' },
  { id: 'chicken', name: 'poulet', quantity: '1 morceau', kind: 'ingredient' },
];
const frenchCodes = (ingredients: [string, string | null][], instructions: string[]) => safetyIssues(recipe(ingredients, instructions), frenchPantry).map((issue) => issue.code);

Deno.test('safetyIssues : garde-manger dans une autre langue que la recette, recettes correctes acceptées', () => {
  // Nom du garde-manger recopié par le modèle, étapes en anglais
  assertEquals(frenchCodes([['pomme de terre', 'potato']], ['Preheat the oven to 200 °C.', 'Cut the potatoes into 1‑cm cubes, toss with 1 tbsp olive oil; spread on a baking sheet and roast 20 minutes, until golden and crisp.']), []);
  assertEquals(frenchCodes([['poisson', 'fish']], ['Preheat the oven to 180 °C.', 'Place the fish fillets on a piece of parchment.', 'Bake in the oven for 10 minutes, until the flesh flakes easily and reaches an internal temperature of 63°C.']), []);
  assertEquals(frenchCodes([['bœuf', 'beef']], ['Pat the beef steaks dry.', 'Sear the steaks 3 minutes per side over medium-high heat, until 63 °C at the centre; rest 3 minutes, the juices run clear.']), []);
  // Nom traduit par le modèle (« potatoes ») : même résultat
  assertEquals(frenchCodes([['potatoes', 'potato']], ['Boil the potatoes 15 minutes, until tender.']), []);
});

Deno.test('safetyIssues : garde-manger dans une autre langue, vrais défauts toujours relevés', () => {
  assertEquals(frenchCodes([['poisson', 'fish']], ['Slice the fish and marinate it in lime juice for 15 minutes.']), ['raw_fish']);
  assertEquals(frenchCodes([['poulet', 'chicken']], ['Fry the chicken 10 minutes.']), ['core_temperature', 'doneness_sign']);
  assertEquals(frenchCodes([['pomme de terre', 'potato']], ['Grate the potatoes into the salad.']), ['not_cooked']);
});

Deno.test('safetyIssues : bœuf ou poisson à la température à cœur sans signe visible : signalé sans bloquer ; volaille : bloquant', () => {
  assertEquals(frenchCodes([['bœuf', 'beef']], ['Bake the beef and rice 25 minutes at 180 °C, until the beef reaches 63 °C inside.']), ['doneness_hint']);
  assertEquals(frenchCodes([['poulet', 'chicken']], ['Bake the chicken 25 minutes at 200 °C, until it reaches 74 °C inside.']), ['doneness_sign']);
});

Deno.test('four : température en °C exigée, niveau de feu retiré des étapes au four', () => {
  assertEquals(ovenWithoutTemperature(recipe([], ['Bake for 18 minutes on medium heat, until golden.'])), true);
  assertEquals(ovenWithoutTemperature(recipe([], ['Preheat the oven to 200 °C.', 'Bake for 18 minutes, until golden.'])), false);
  assertEquals(ovenWithoutTemperature(recipe([], ['Enfourne 20 minutes à 180 °C.'])), false);
  // « four » nombre anglais, levure chimique : pas un four
  assertEquals(ovenWithoutTemperature(recipe([], ['Cook for four minutes.', 'Add 1 tsp baking powder.'])), false);
  assertEquals(withoutOvenHeatLevel('Roast the pumpkin 20 minutes on medium heat, stirring halfway.'), 'Roast the pumpkin 20 minutes, stirring halfway.');
  assertEquals(withoutOvenHeatLevel('Enfourne le gratin 20 minutes à feu moyen.'), 'Enfourne le gratin 20 minutes.');
  assertEquals(withoutOvenHeatLevel('Hornea 15 minutos a fuego medio.'), 'Hornea 15 minutos.');
  // Sur la plaque : inchangé
  assertEquals(withoutOvenHeatLevel('Sear the steak in a skillet over medium-high heat.'), 'Sear the steak in a skillet over medium-high heat.');
});

Deno.test('four : la température du four ne remplace jamais la température à cœur de la viande ou du poisson', () => {
  // 200 °C au four, jus clair, sans température à cœur : bloquant
  assertEquals(frenchCodes([['poulet', 'chicken']], ['Bake the chicken 25 minutes at 200 °C, until the juices run clear.']), ['core_temperature']);
  assertEquals(frenchCodes([['poisson', 'fish']], ['Enfourne le poisson 15 minutes à 180 °C, jusqu’à ce que la chair soit opaque.']), ['core_temperature']);
  // Four sans température mais cuisson à cœur écrite : seul le défaut non bloquant du four reste
  assertEquals(frenchCodes([['bœuf', 'beef']], ['Bake the beef 20 minutes, until 63 °C inside and tender.']), ['oven_celsius']);
  // Four sans température et sans cuisson à cœur : la température à cœur reste exigée
  assertEquals(frenchCodes([['poulet', 'chicken']], ['Bake the chicken 25 minutes, until the juices run clear.']), ['core_temperature', 'oven_celsius']);
});

Deno.test('safetyIssues : crevettes « hasta que cambien a color rosa » : signe visible reconnu (évaluation du 02/10)', () => {
  assertEquals(codes(recipe([['Camarones', null]], ['Agrega los camarones y cocina 2-3 minutos, hasta que cambien a color rosa.'])), []);
});
