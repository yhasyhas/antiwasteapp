// Mode cuisine : lecture des durées (minuteurs proposés) et de la température à cœur dans les étapes, en
// français, anglais et espagnol. Lancement : deno test --no-config --allow-env supabase/functions/ lib/
import { assertEquals } from 'jsr:@std/assert@1';
import { coreTemperature, formatTimer, stepDurations, stepIngredients } from './cookingSteps.ts';

const secs = (s: string) => stepDurations(s).map((d) => d.seconds);
Deno.test('mode cuisine : durées des étapes', () => {
  assertEquals(secs('Faites revenir les oignons 5 à 7 minutes à feu moyen.'), [420]);
  assertEquals(secs('Laissez mijoter 15 minutes, puis ajoutez le riz et comptez encore 18 min.'), [900, 1080]);
  assertEquals(secs('Enfournez à 180 °C pendant 1 h 30.'), [5400]);
  assertEquals(secs('Bake for 1 hour 15 minutes at 200 °C.'), [4500]);
  assertEquals(secs('Simmer for 10-12 minutes until tender.'), [720]);
  assertEquals(secs('Cocina de 3 a 4 minutos por cada lado.'), [240]);
  assertEquals(secs('Hornea durante media hora.'), [1800]);
  assertEquals(secs('Laissez reposer une demi-heure.'), [1800]);
  assertEquals(secs('Cook for a minute, stirring.'), [60]);
  assertEquals(secs('Fouettez 30 secondes.'), [30]);
  assertEquals(secs('Coupez 4 tomates et 2 sachets de levure, pour 4 personnes.'), []);
  assertEquals(secs('Cuire dos o tres minutos.'), [180]);
  assertEquals(secs('Laissez cuire 1 heure et demie.'), [5400]);
  assertEquals(stepDurations('Faites revenir 5 à 7 minutes.')[0].text, '5 à 7 minutes');
});
Deno.test('mode cuisine : température à cœur', () => {
  // Espace insécable entre le nombre et « °C »
  const nbsp = String.fromCharCode(160);
  assertEquals(coreTemperature('Cuisez jusqu’à 74 °C à cœur (le jus est clair).'), `74${nbsp}°C`);
  assertEquals(coreTemperature('Cook until the internal temperature reaches 63 °C.'), `63${nbsp}°C`);
  assertEquals(coreTemperature('Cocina hasta que la temperatura interna alcance 71 °C.'), `71${nbsp}°C`);
  assertEquals(coreTemperature('Enfournez à 180 °C pendant 20 minutes.'), null);
});
Deno.test('mode cuisine : ingrédients de l’étape', () => {
  const items = [{ name: 'Pommes de terre' }, { name: 'Oignon' }, { name: "Huile d'olive" }, { name: 'Cuisses de poulet' }, { name: 'Sel' }];
  assertEquals(stepIngredients('Faites dorer les oignons dans un filet d’huile, puis ajoutez le poulet.', items).map((i) => i.name), ['Oignon', "Huile d'olive", 'Cuisses de poulet']);
  assertEquals(stepIngredients('Épluchez les pommes de terre et salez.', items).map((i) => i.name), ['Pommes de terre']);
});
Deno.test('mode cuisine : affichage des minuteurs', () => {
  assertEquals([formatTimer(420), formatTimer(59.2), formatTimer(4500)], ['7:00', '1:00', '1:15:00']);
});
