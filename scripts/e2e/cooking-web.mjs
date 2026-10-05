// Parcours de bout en bout, version web : choix des cuisines (Préférences), « Mes recettes » sur l'accueil (favori
// ancien en tête, « Tout voir » sur l'onglet Favoris) et mode cuisine (séance préparée dans le stockage local : mise
// en place, étapes avec icônes des ingrédients, minuteurs simultanés, température à cœur, reprise, « C'est prêt ! »
// avec la photo du plat).
// Compte de test créé par l'API admin (aucun e-mail envoyé), supprimé à la fin ; aucun secret affiché.
// Prérequis : app web lancée (npx expo start --web --port 8082), Chrome installé, puppeteer-core disponible
// (npm i --no-save puppeteer-core). Lancement depuis la racine : node scripts/e2e/cooking-web.mjs [dossier des captures]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';

const out = process.argv[2] ?? fs.mkdtempSync(path.join(os.tmpdir(), 'cooking-web-'));
const { secretKey } = await import(pathToFileURL(process.cwd() + '/scripts/recipe-eval/call.mjs').href);
const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split(/\r?\n/).filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const URL_ = env.EXPO_PUBLIC_SUPABASE_URL, PUB = env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SECRET = secretKey();
const admin = { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (label, ok) => console.log(`${ok ? 'OK' : 'ÉCHEC'} : ${label}`);

// Photo du plat : petite image intégrée (aucun appel à Cloudflare)
const PHOTO = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="30"><rect width="40" height="30" fill="#c8963e"/></svg>').toString('base64')}`;
const recipe = {
  title: 'Poulet yassa', servings: 4, language: 'fr', image_url: PHOTO, instructions: [
    "Émincez les oignons et faites-les revenir dans l'huile 8 à 10 minutes à feu moyen.",
    'Ajoutez le poulet et faites-le dorer 5 minutes de chaque côté.',
    "Couvrez et laissez mijoter 25 minutes, jusqu'à 74 °C à cœur (le jus doit être clair).",
    'Servez avec le riz.',
  ],
  ingredients_used: [
    { name: 'Cuisses de poulet', quantity: '4', unit: '', pantry_id: null },
    { name: 'Oignons', quantity: '3', unit: '', pantry_id: null },
    { name: 'Huile', quantity: '2', unit: 'c. à soupe', pantry_id: null },
    { name: 'Riz', quantity: '300', unit: 'g', pantry_id: null },
  ],
};
const cooking = { recipe, key: 'title:Poulet yassa', phase: 'prep', step: 0, prepared: [], timers: [], startedAt: Date.now() };

const email = `p9b-${Date.now()}@example.com`;
let userId = null;
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--lang=fr-FR'] });
try {
  userId = (await (await fetch(`${URL_}/auth/v1/admin/users`, { method: 'POST', headers: admin, body: JSON.stringify({ email, password: `T${crypto.randomUUID()}!`, email_confirm: true }) })).json()).id;
  const link = await (await fetch(`${URL_}/auth/v1/admin/generate_link`, { method: 'POST', headers: admin, body: JSON.stringify({ type: 'magiclink', email }) })).json();
  const session = await (await fetch(`${URL_}/auth/v1/verify`, { method: 'POST', headers: { apikey: PUB, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'magiclink', token_hash: link.hashed_token ?? link.properties?.hashed_token }) })).json();
  await fetch(`${URL_}/rest/v1/profiles`, { method: 'POST', headers: { apikey: PUB, Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: userId, email }) });

  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.evaluateOnNewDocument((storageKey, auth, cook) => {
    localStorage.setItem('app_language', 'fr');
    localStorage.setItem(storageKey, auth);
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('cooking_session', cook);
      sessionStorage.setItem('seeded', '1');
    }
  }, `sb-${new URL(URL_).hostname.split('.')[0]}-auth-token`, JSON.stringify({ ...session, expires_at: Math.floor(Date.now() / 1000) + session.expires_in }), JSON.stringify(cooking));
  page.on('pageerror', (e) => console.log('  erreur de page :', e.message.slice(0, 200)));
  const tap = async (label, { last = false } = {}) => {
    const ok = await page.evaluate((l, lst) => {
      const hits = [...document.querySelectorAll('[role=button],[role=checkbox],[tabindex="0"]')]
        .filter((el) => (el.offsetParent !== null || el.getClientRects().length > 0) && (el.innerText || el.getAttribute('aria-label') || '').trim().startsWith(l));
      const el = lst ? hits[hits.length - 1] : hits[0];
      if (!el) return false;
      el.click();
      return true;
    }, label, last);
    if (!ok) throw new Error(`introuvable : « ${label} »`);
    await sleep(1000);
  };
  const has = async (value) => (await page.evaluate(() => document.body.innerText)).includes(value);
  const shot = (name) => page.screenshot({ path: path.join(out, name) });

  // Préférences : familles, régions, « Autre cuisine… »
  await page.goto('http://localhost:8082/', { waitUntil: 'networkidle2', timeout: 180_000 });
  await sleep(3000);
  await tap('Réglages', { last: true });
  await sleep(1500);
  await page.evaluate(() => [...document.querySelectorAll('[role=button],[tabindex="0"]')].find((el) => (el.innerText || '').includes('Régimes, exclusions'))?.click());
  await sleep(2500);
  await shot('0-preferences.png');
  await tap('Afrique');
  check("régions de l'Afrique affichées", await has("Toute l'Afrique") && await has("Afrique de l'Ouest") && await has('Océan Indien'));
  await page.evaluate(() => document.querySelectorAll('div').forEach((el) => { if (el.scrollHeight > el.clientHeight + 50) el.scrollTop = 900; }));
  await sleep(800);
  await shot('1-preferences-afrique.png');
  await tap("Afrique de l'Ouest");
  await tap('Autre cuisine');
  check('champ « Autre cuisine… » affiché', await page.evaluate(() => !!document.querySelector('input[placeholder*="géorgienne"]')));
  await page.type('input[placeholder*="géorgienne"]', 'Géorgienne');
  await shot('2-preferences-autre.png');
  await tap('Enregistrer');
  await sleep(2000);
  const saved = await (await fetch(`${URL_}/rest/v1/user_preferences?user_id=eq.${userId}&select=default_cuisine,default_cuisine_other`, { headers: admin })).json();
  check(`préférence enregistrée (${JSON.stringify(saved)})`, saved[0]?.default_cuisine === 'other' && saved[0]?.default_cuisine_other === 'Géorgienne');

  // Accueil, « Mes recettes » : un favori plus ancien que les 30 dernières recettes passe en tête
  const asUser = { apikey: PUB, Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' };
  const rows = [{ user_id: userId, title: 'Favori ancien', created_at: '2026-01-01T12:00:00Z', ingredients_used: [], instructions: ['Servez.'] }]
    .concat(Array.from({ length: 30 }, (_, i) => ({ user_id: userId, title: `Recette récente ${i + 1}`, created_at: new Date(Date.now() - i * 60_000).toISOString(), ingredients_used: [], instructions: ['Servez.'] })));
  const inserted = await (await fetch(`${URL_}/rest/v1/recipes?select=id,title`, { method: 'POST', headers: { ...asUser, Prefer: 'return=representation' }, body: JSON.stringify(rows) })).json();
  const favorite = inserted.find((row) => row.title === 'Favori ancien');
  await fetch(`${URL_}/rest/v1/favorites`, { method: 'POST', headers: asUser, body: JSON.stringify({ user_id: userId, recipe_id: favorite.id }) });
  await page.goto('http://localhost:8082/', { waitUntil: 'networkidle2', timeout: 180_000 });
  await sleep(3500);
  const homeText = await page.evaluate(() => document.body.innerText);
  const favoriteAt = homeText.indexOf('Favori ancien'), recentAt = homeText.indexOf('Recette récente 1');
  check('accueil : favori ancien affiché, en tête de « Mes recettes »', favoriteAt >= 0 && (recentAt < 0 || favoriteAt < recentAt));
  await shot('1b-accueil-favoris.png');
  await tap('Tout voir');
  await sleep(2000);
  // Onglet Favoris : seul le favori est listé (l'onglet Toutes montrerait les 31 recettes)
  check('« Tout voir » : onglet Favoris', await has('Favoris · 1') && await has('Favori ancien') && !(await has('Recette récente 2')));
  await shot('1c-tout-voir.png');

  // Mode cuisine
  await page.goto('http://localhost:8082/', { waitUntil: 'networkidle2', timeout: 180_000 });
  await sleep(3000);
  await tap('En cuisine');
  await sleep(2500);
  check('mise en place : 4 ingrédients et quantités', await has('Mise en place') && await has('Cuisses de poulet') && await has('300 g'));
  await tap('Oignons');
  check('ingrédient coché', await has('1 sur 4 prêts'));
  await shot('3-mise-en-place.png');
  await tap("C'est parti");
  check('étape 1 sur 4', await has('Étape 1 sur 4'));
  check('minuteur proposé : 10 min (fourchette 8 à 10)', await has('Minuteur 10 min'));
  check("ingrédients de l'étape rappelés", await has('POUR CETTE ÉTAPE') && await has('Oignons'));
  check("icônes des ingrédients de l'étape", await page.evaluate(() => {
    const title = [...document.querySelectorAll('div')].find((el) => el.innerText === 'POUR CETTE ÉTAPE' && el.children.length === 0);
    return !!title && title.parentElement.querySelectorAll('svg').length >= 2;
  }));
  await shot('4-etape-1.png');
  await tap('Minuteur 10 min');
  await tap('Une minute de plus');
  check('réglage 11:00', await has('11:00'));
  await tap('Lancer');
  check('minuteur en haut : Étape 1 · 10:5x', await has('10:5'));
  await shot('5-minuteur.png');
  await tap('Suivant');
  await tap('Suivant');
  check('étape 3 : température à cœur mise en évidence', await has('Température à cœur : 74'));
  await tap('Minuteur 25 min');
  await tap('Lancer');
  check('deux minuteurs en même temps', await has('Étape 1 ·') && await has('Étape 3 · 2'));
  await shot('6-etape-3.png');

  // Reprise : on quitte et on revient à la même étape, minuteurs en cours
  await page.goto('http://localhost:8082/', { waitUntil: 'networkidle2', timeout: 180_000 });
  await sleep(3000);
  check('accueil : bandeau « En cuisine »', await has('En cuisine : Poulet yassa') && await has('Étape 3 sur 4'));
  await shot('7-accueil-bandeau.png');
  await tap('En cuisine');
  await sleep(2000);
  check("reprise à l'étape 3 avec les minuteurs", await has('Étape 3 sur 4') && await has('Étape 1 ·') && await has('Étape 3 ·'));
  await tap('Suivant');
  await tap("C'est prêt");
  check("écran « C'est prêt ! »", await has('Bon appétit'));
  check('photo du plat et légende', await page.evaluate(() => [...document.querySelectorAll('img')].some((img) => img.src.startsWith('data:image/svg'))) && await has('Illustration générée, à titre indicatif'));
  await shot('8-pret.png');
  await tap('Fermer', { last: true });
  await sleep(1500);
  check('séance terminée', await page.evaluate(() => localStorage.getItem('cooking_session') === null));
  await context.close();
} catch (error) {
  console.log('ÉCHEC :', error.message.slice(0, 300));
} finally {
  await browser.close();
  if (userId) console.log('compte de test supprimé :', (await fetch(`${URL_}/auth/v1/admin/users/${userId}`, { method: 'DELETE', headers: admin })).status);
}
console.log('captures :', out);
