import { assertEquals } from 'jsr:@std/assert@1';
import { celsiusWithoutMeat, heatWithoutCooking, longestMinutes, type SafetyPantryItem, safetyIssues, stoveCelsius } from './safety.ts';

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
  assertEquals(codes(recipe([['Lentilles corail', null]], ['Cuis les lentilles corail 20 minutes dans 600 ml d\'eau.'])), []);
  // Haricots verts : pas des légumineuses sèches
  assertEquals(codes(recipe([['Haricots verts', null]], ['Fais blanchir les haricots verts 4 minutes.'])), []);
});

Deno.test('safetyIssues : viande crue, température à cœur au seuil et signe visible', () => {
  assertEquals(codes(recipe([['Cuisses de poulet', 'chicken']], ['Fais dorer le poulet 25 minutes à feu moyen.'])), ['core_temperature', 'doneness_sign']);
  assertEquals(codes(recipe([['Cuisses de poulet', 'chicken']], ['Fais dorer le poulet 25 minutes à feu moyen, jusqu\'à ce que le jus soit clair (74 °C à cœur).'])), []);
  // Porc sous le seuil
  assertEquals(codes(recipe([['Filet de porc', null]], ['Saisis le porc 8 minutes, jusqu\'à 60 °C à cœur et un jus clair.'])), ['core_temperature']);
  // Bouillon de poulet : pas de la viande crue
  assertEquals(codes(recipe([['Bouillon de poulet', null]], ['Verse le bouillon de poulet et laisse mijoter 10 minutes.'])), []);
  // Cuisson au four dans une étape qui ne nomme pas la viande
  assertEquals(codes(recipe([['Dorade', 'fish']], ['Pose la dorade dans un plat.', 'Enfourne 20 minutes à 200 °C, jusqu\'à ce que la chair soit opaque et atteigne 63 °C à cœur.'])), []);
});

Deno.test('safetyIssues : ingrédient au pluriel dans la liste, au singulier dans les étapes', () => {
  assertEquals(codes(recipe([['Ignames', null]], ['Épluche l\'igname et fais-la bouillir 20 minutes, jusqu\'à ce qu\'elle soit tendre.'])), []);
  assertEquals(codes(recipe([['Ignames', null]], ['Épluche l\'igname et coupe-la en dés.'])), ['not_cooked']);
});

Deno.test('safetyIssues : poisson cru seulement s\'il a été congelé avant', () => {
  assertEquals(codes(recipe([['Dorade', 'fish']], ['Coupe la dorade en dés et arrose de citron vert 15 minutes.'])), ['raw_fish']);
  assertEquals(codes(recipe([['Dorade', 'fish']], ['Utilise une dorade très fraîche, préalablement congelée 7 jours.', 'Coupe la dorade en dés et arrose de citron vert.'])), []);
});

Deno.test('safetyIssues : restes réchauffés à cœur, riz cuit refroidi vite', () => {
  assertEquals(codes(recipe([['Tajine de poulet', 'tajine']], ['Réchauffe le tajine 5 minutes à la poêle.'])), ['leftover_reheat']);
  assertEquals(codes(recipe([['Tajine de poulet', 'tajine']], ['Réchauffe le tajine 5 minutes à la poêle, jusqu\'à ce qu\'il soit fumant à cœur.'])), []);
  assertEquals(codes(recipe([['Riz cuit', null]], ['Fais sauter le riz cuit 4 minutes.'])), ['leftover_reheat']);
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
