// Génération de recettes (fonction generate-recipes de l'app, déployée) : cas relevé sur téléphone en phase 10, cuisine
// d'Afrique de l'Est avec bœuf, poivron, tomate et oignon. Vérifie : 3 recettes, aucune paire trop proche (même type de
// plat et même technique : generate-recipes/variety.ts), champs internes (dish_type, technique) absents de la réponse,
// rapport de variété dans le détail (debug). Compte de test créé par l'API admin, supprimé à la fin ; aucun secret affiché.
// Lancement depuis la racine : node scripts/e2e/generate-variety.mjs
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const { secretKey } = await import(pathToFileURL(process.cwd() + '/scripts/recipe-eval/call.mjs').href);
const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split(/\r?\n/).filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
const URL_ = env.EXPO_PUBLIC_SUPABASE_URL, PUB = env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SECRET = secretKey();
const admin = { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' };
let failures = 0;
const check = (label, ok) => {
  if (!ok) failures++;
  console.log(`${ok ? 'OK' : 'ÉCHEC'} : ${label}`);
};

const email = `variety-${Date.now()}@example.com`;
let userId = null;
try {
  userId = (await (await fetch(`${URL_}/auth/v1/admin/users`, { method: 'POST', headers: admin, body: JSON.stringify({ email, password: `T${crypto.randomUUID()}!`, email_confirm: true }) })).json()).id;
  const link = await (await fetch(`${URL_}/auth/v1/admin/generate_link`, { method: 'POST', headers: admin, body: JSON.stringify({ type: 'magiclink', email }) })).json();
  const session = await (await fetch(`${URL_}/auth/v1/verify`, { method: 'POST', headers: { apikey: PUB, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'magiclink', token_hash: link.hashed_token ?? link.properties?.hashed_token }) })).json();
  const ingredients = ['bœuf haché', 'poivron', 'tomates', 'oignon', 'riz', 'gingembre'].map((name, i) => ({ id: `00000000-0000-4000-a000-00000000${String(i + 1).padStart(4, '0')}`, name, quantity: '', days_left: i === 0 ? 1 : 6 }));
  const t0 = Date.now();
  const response = await fetch(`${URL_}/functions/v1/generate-recipes`, {
    method: 'POST',
    headers: { apikey: PUB, Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ingredients, preferences: { mealType: 'dinner', cuisine: 'afrique-est', language: 'fr' }, debug: true }),
  });
  const data = await response.json();
  const recipes = data.recipes ?? [];
  console.log(`réponse ${response.status} en ${Math.round((Date.now() - t0) / 1000)} s : ${recipes.map((r) => r.title).join(' | ')}`);
  console.log(`variété : ${JSON.stringify(data.debug?.variety)}`);
  check('génération réussie', response.ok && recipes.length === 3);
  check('champs internes absents de la réponse', recipes.every((r) => !('dish_type' in r) && !('technique' in r)));
  check('rapport de variété présent', data.debug?.variety && Array.isArray(data.debug.variety.close));
  check('aucune recette gardée trop proche', (data.debug?.variety?.kept ?? []).length === 0);
} catch (error) {
  failures++;
  console.log('ÉCHEC :', String(error?.message ?? error).slice(0, 300));
} finally {
  if (userId) console.log('compte de test supprimé :', (await fetch(`${URL_}/auth/v1/admin/users/${userId}`, { method: 'DELETE', headers: admin })).status);
  console.log(failures ? `${failures} échec(s)` : 'tout est OK');
}
