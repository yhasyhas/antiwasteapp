// Catégorie (icône) d'un ingrédient de recette d'après son nom, en trois langues.
// Lancement : deno test --no-config --allow-env supabase/functions/ lib/
import { assertEquals } from 'jsr:@std/assert@1';
import { guessFoodCategory } from './foodCategory.ts';

Deno.test('catégorie d’un ingrédient : français', () => {
  const cases: [string, string | null][] = [
    ['Cuisses de poulet', 'meat'], ['Oignons', 'vegetable'], ["Huile d'olive", 'condiment'], ['Pommes de terre', 'vegetable'],
    ['Pommes', 'fruit'], ['Haricots verts', 'vegetable'], ['Haricots rouges', 'legume'], ['Pois chiches', 'legume'],
    ['Œufs', 'egg'], ['Crème fraîche', 'dairy'], ['Lait de coco', 'condiment'], ['Lait', 'dairy'], ['Riz basmati', 'grain'],
    ['Sauce tomate', 'condiment'], ['Dorade entière', 'fish'], ['Sel', 'spice'], ['Poivre noir', 'spice'], ['Pain', 'bakery'],
    ['Eau', 'beverage'], ['Maïs', 'grain'], ['Zeste', null],
  ];
  for (const [name, category] of cases) assertEquals(guessFoodCategory(name, 'fr'), category, name);
});

Deno.test('catégorie d’un ingrédient : anglais', () => {
  const cases: [string, string | null][] = [
    ['chicken thighs', 'meat'], ['red bell peppers', 'vegetable'], ['tomato sauce', 'condiment'], ['green beans', 'vegetable'],
    ['black beans', 'legume'], ['eggs', 'egg'], ['coconut milk', 'condiment'], ['whole sea bream', 'fish'], ['black pepper', 'spice'],
    ['sweet potatoes', 'vegetable'], ['penne', 'grain'], ['lemons', 'fruit'],
  ];
  for (const [name, category] of cases) assertEquals(guessFoodCategory(name, 'en'), category, name);
});

Deno.test('catégorie d’un ingrédient : espagnol', () => {
  const cases: [string, string | null][] = [
    ['Muslos de pollo', 'meat'], ['Cebollas', 'vegetable'], ['Pimientos rojos', 'vegetable'], ['Pimienta negra', 'spice'],
    ['Garbanzos', 'legume'], ['Huevos', 'egg'], ['Queso rallado', 'dairy'], ['Arroz', 'grain'], ['Aceite de oliva', 'condiment'],
    ['Judías verdes', 'vegetable'], ['Leche de coco', 'condiment'], ['Plátanos', 'fruit'],
  ];
  for (const [name, category] of cases) assertEquals(guessFoodCategory(name, 'es'), category, name);
});
