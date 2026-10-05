// Consignes d'image v1 (par défaut) et v2 (cuisine maison). Lancement : deno test --no-config --allow-env supabase/functions/ lib/
import { assert, assertEquals } from 'jsr:@std/assert@1';
import { buildImagePrompt, dishDescription, imagePromptVersion } from './imagePrompt.ts';

const MAFE = {
  title: 'Mafé de poulet',
  description: null,
  image_prompt: 'Professional food photography, hearty chicken mafé in a rustic clay pot, creamy peanut sauce, bright red tomatoes, warm lighting',
};

Deno.test('image : version v1 par défaut, v2 seulement si demandée', () => {
  assertEquals(imagePromptVersion(undefined), 'v1');
  assertEquals(imagePromptVersion(''), 'v1');
  assertEquals(imagePromptVersion('v3'), 'v1');
  assertEquals(imagePromptVersion('v2'), 'v2');
});

Deno.test('image v1 : consigne de generate-recipes inchangée', () => {
  assertEquals(buildImagePrompt(MAFE, 'v1'), MAFE.image_prompt);
  assert(buildImagePrompt({ title: 'Soupe', description: 'légère', image_prompt: null }, 'v1').startsWith('Professional food photography of Soupe, légère.'));
});

Deno.test('image v2 : plat gardé, style professionnel retiré, style maison ajouté', () => {
  const prompt = buildImagePrompt(MAFE, 'v2');
  assert(prompt.startsWith('Homemade hearty chicken mafé in a rustic clay pot, creamy peanut sauce, bright red tomatoes, warm lighting. '), prompt);
  assert(!/professional|food photography/i.test(prompt));
  assert(/home kitchen/.test(prompt) && /natural daylight/.test(prompt) && /imperfect/.test(prompt));
  assert(prompt.length <= 1000);
});

Deno.test('image v2 : mots de studio retirés de la description', () => {
  assertEquals(dishDescription('Professional food photography of a whole grilled sea bream, 8k, shallow depth of field, lemon slices'), 'a whole grilled sea bream, lemon slices');
  assertEquals(dishDescription('Gourmet food styling, elegantly plated zucchini soup, studio lighting'), 'zucchini soup');
  // Rien d'autre que du style : le titre de la recette prend le relais
  assert(buildImagePrompt({ title: 'Dorade grillée', description: null, image_prompt: 'Professional food photography, 4k' }, 'v2').startsWith('Homemade Dorade grillée. ') === false);
  assert(buildImagePrompt({ title: 'Dorade grillée', description: null, image_prompt: 'Professional food photography, 4k' }, 'v2').startsWith('Homemade dorade grillée. '));
});

Deno.test('image v1.1 : v1 inchangée sans poisson ni volaille entière', () => {
  assertEquals(imagePromptVersion('v1.1'), 'v1.1');
  assertEquals(buildImagePrompt(MAFE, 'v1.1'), MAFE.image_prompt);
  const roastChicken = 'Professional food photography, chicken thighs in a creamy peanut sauce, natural light';
  assertEquals(buildImagePrompt({ title: 'Poulet', description: null, image_prompt: roastChicken }, 'v1.1'), roastChicken);
});

Deno.test('image v1.1 : poisson en filets ou morceaux, sans « whole » ni tête', () => {
  const prompt = buildImagePrompt({
    title: 'Dorade',
    description: null,
    image_prompt: 'Professional food photography, whole grilled sea bream with its head, lemon slices, onion sauce, natural light',
  }, 'v1.1');
  assertEquals(prompt, 'Professional food photography, grilled sea bream, lemon slices, onion sauce, natural light. The fish is served as fillets or chunks, partly covered by the sauce, seen from a normal table distance.');
});

Deno.test('image v1.1 : volaille entière découpée', () => {
  const prompt = buildImagePrompt({ title: 'Poulet rôti', description: null, image_prompt: 'Professional food photography, golden whole roast chicken with potatoes, roasting dish' }, 'v1.1');
  assertEquals(prompt, 'Professional food photography, golden roast chicken with potatoes, roasting dish. The poultry is carved into pieces, partly in the sauce.');
});
