// Phase 10, partie A, version web : premier lancement guidé (complet, puis version courte avec une invitation),
// « Mes basiques », notes et signalement d'une recette, « Donner mon avis », garde-manger étroit, « Mot de passe oublié ».
// Comptes de test créés par l'API admin (aucun e-mail envoyé), supprimés à la fin avec leurs avis et signalements ;
// aucun secret affiché. Les appels aux fonctions passent par un relais (puppeteer) qui ajoute la clé secrète
// (événements Sentry dans l'environnement « test ») et les en-têtes CORS du serveur web local.
// Prérequis : app web lancée (npx expo start --web --port 8082), Chrome installé, puppeteer-core disponible
// (npm i --no-save puppeteer-core). Lancement depuis la racine : node scripts/e2e/first-contact-web.mjs [dossier des captures]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';

const out = process.argv[2] ?? fs.mkdtempSync(path.join(os.tmpdir(), 'first-contact-'));
const { secretKey } = await import(pathToFileURL(process.cwd() + '/scripts/recipe-eval/call.mjs').href);
const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split(/\r?\n/).filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const URL_ = env.EXPO_PUBLIC_SUPABASE_URL, PUB = env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SECRET = secretKey();
const APP = 'http://localhost:8082/';
const admin = { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (label, ok) => console.log(`${ok ? 'OK' : 'ÉCHEC'} : ${label}`);
const storageKey = `sb-${new URL(URL_).hostname.split('.')[0]}-auth-token`;
const rest = async (pathAndQuery, init = {}) => {
  const text = await (await fetch(`${URL_}/rest/v1/${pathAndQuery}`, { headers: admin, ...init })).text();
  return text ? JSON.parse(text) : null;
};

async function createUser(label) {
  const email = `${label}-${Date.now()}@example.com`;
  const id = (await (await fetch(`${URL_}/auth/v1/admin/users`, { method: 'POST', headers: admin, body: JSON.stringify({ email, password: `T${crypto.randomUUID()}!`, email_confirm: true }) })).json()).id;
  const link = await (await fetch(`${URL_}/auth/v1/admin/generate_link`, { method: 'POST', headers: admin, body: JSON.stringify({ type: 'magiclink', email }) })).json();
  const session = await (await fetch(`${URL_}/auth/v1/verify`, { method: 'POST', headers: { apikey: PUB, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'magiclink', token_hash: link.hashed_token ?? link.properties?.hashed_token }) })).json();
  return { id, email, session };
}

const users = [];
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--lang=fr-FR'] });

async function openPage(user, extraStorage = {}) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.evaluateOnNewDocument((key, auth, extra) => {
    if (sessionStorage.getItem('seeded')) return;
    localStorage.setItem('app_language', 'fr');
    if (auth) localStorage.setItem(key, auth);
    for (const [k, v] of Object.entries(extra)) localStorage.setItem(k, v);
    sessionStorage.setItem('seeded', '1');
  }, storageKey, user ? JSON.stringify({ ...user.session, expires_at: Math.floor(Date.now() / 1000) + user.session.expires_in }) : null, extraStorage);
  // Relais des fonctions : clé secrète ajoutée (essais), réponse rendue avec les en-têtes CORS
  await page.setRequestInterception(true);
  page.on('request', async (request) => {
    if (!request.url().startsWith(`${URL_}/functions/v1/`)) return request.continue();
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
    if (request.method() === 'OPTIONS') return request.respond({ status: 204, headers: cors });
    const response = await fetch(request.url(), { method: request.method(), headers: { ...request.headers(), 'x-simulate-key': SECRET }, body: request.postData() });
    request.respond({ status: response.status, headers: { ...cors, 'Content-Type': 'application/json' }, body: await response.text() });
  });
  page.on('pageerror', (e) => console.log('  erreur de page :', e.message.slice(0, 200)));
  // Erreurs écrites dans la console par l'app (création du profil…)
  const consoleErrors = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  const tap = async (label, { last = false, exact = false } = {}) => {
    const ok = await page.evaluate((l, lst, ex) => {
      const hits = [...document.querySelectorAll('[role=button],[role=link],[role=checkbox],[role=tab],[tabindex="0"]')]
        .filter((el) => (el.offsetParent !== null || el.getClientRects().length > 0))
        .filter((el) => [el.innerText, el.getAttribute('aria-label')].some((value) => { const text = (value || '').trim(); return text !== '' && (ex ? text === l : text.startsWith(l)); }));
      const el = lst ? hits[hits.length - 1] : hits[0];
      if (!el) return false;
      el.click();
      return true;
    }, label, last, exact);
    if (!ok) throw new Error(`introuvable : « ${label} »`);
    await sleep(900);
  };
  // Texte présent, en attendant jusqu'à 6 s (chargements, fondus d'apparition)
  const has = async (value, waitMs = 6000) => {
    for (let waited = 0; ; waited += 500) {
      if ((await page.evaluate(() => document.body.innerText)).includes(value)) return true;
      if (waited >= waitMs) return false;
      await sleep(500);
    }
  };
  const absent = async (value) => !(await has(value, 0));
  const shot = (name) => page.screenshot({ path: path.join(out, name) });
  const type = async (selector, text) => {
    await page.type(selector, text);
    await sleep(300);
  };
  return { page, tap, has, absent, shot, type, context, consoleErrors };
}

try {
  // ---------- 1. Premier lancement complet ----------
  const a = await createUser('contact-a');
  users.push(a);
  const A = await openPage(a);
  await A.page.goto(APP, { waitUntil: 'networkidle2', timeout: 180_000 });
  await sleep(3500);
  check('premier lancement : écran 1', await A.has('Cuisine ce que tu as, gaspille moins'));
  await A.shot('1-guide-1.png');
  await A.tap('Suivant');
  check('écran 2 : garde-manger partagé', await A.has('Un garde-manger partagé'));
  await A.tap('Suivant');
  check('écran 3 : recettes sûres', await A.has('Des recettes sûres'));
  await A.shot('2-guide-3.png');
  await A.tap('Continuer');
  check('questions facultatives', await A.has('Des recettes à ta mesure'));
  await A.tap('Végétarien');
  await A.tap('+', { exact: true });
  await A.shot('3-questions.png');
  await A.tap('Continuer', { last: true });
  await sleep(1500);
  check('première action guidée', await A.has('Ajoute tes premiers aliments'));
  await A.shot('4-premiere-action.png');
  const [profile] = await rest(`profiles?id=eq.${a.id}&select=onboarded_at`);
  check('guide noté sur le compte', !!profile?.onboarded_at);
  const [prefs] = await rest(`user_preferences?user_id=eq.${a.id}&select=dietary_preferences,servings`);
  check(`réponses enregistrées (${JSON.stringify(prefs)})`, prefs?.dietary_preferences?.includes('Vegetarian') && prefs?.servings === 1);
  await A.tap('Ajouter à la main');
  await sleep(2500);
  check('« Ajouter à la main » ouvert dans le Scanner', await A.has('Ajouter des ingrédients'));
  await A.shot('5-a-la-main.png');
  await A.page.goto(APP, { waitUntil: 'networkidle2', timeout: 180_000 });
  await sleep(3500);
  check(`profil créé sans erreur (${A.consoleErrors.filter((e) => e.includes('profile')).length})`, !A.consoleErrors.some((e) => e.includes('Error creating profile')));
  check('pas de second affichage du guide', await A.has('Bonjour') && await A.absent('Cuisine ce que tu as, gaspille moins'));

  // ---------- 2. Garde-manger étroit (un seul aliment) ----------
  const [member] = await rest(`household_members?user_id=eq.${a.id}&select=household_id`);
  if (member) {
    await rest('ingredients', { method: 'POST', headers: { ...admin, Prefer: 'return=minimal' }, body: JSON.stringify({ user_id: a.id, household_id: member.household_id, name: 'tomates', quantity: '3' }) });
    await A.page.goto(APP, { waitUntil: 'networkidle2', timeout: 180_000 });
    await sleep(3500);
    await A.tap('Trouver une recette');
    await sleep(2500);
    check('garde-manger étroit : suggestion affichée', await A.has('Ajoute 1 ou 2 ingrédients pour plus d’idées.'));
    await A.shot('6-garde-manger-etroit.png');
  } else check('garde-manger étroit (foyer introuvable)', false);

  // ---------- 3. Mes basiques ----------
  await A.page.goto(APP, { waitUntil: 'networkidle2', timeout: 180_000 });
  await sleep(3000);
  await A.tap('Réglages', { last: true });
  await A.page.evaluate(() => [...document.querySelectorAll('[role=button],[tabindex="0"]')].find((el) => (el.innerText || '').includes('Régimes, exclusions'))?.click());
  await sleep(2500);
  check('Mes basiques : sel, poivre, huile, eau', await A.has('Mes basiques') && await A.has('Sel') && await A.has('Eau'));
  await A.tap('Ajouter Ail');
  await A.tap('Ajouter Épices courantes');
  await A.tap('Retirer Sel');
  await A.shot('7-basiques.png');
  await A.tap('Enregistrer');
  await sleep(2000);
  const [basics] = await rest(`user_preferences?user_id=eq.${a.id}&select=basics`);
  check(`basiques enregistrés (${JSON.stringify(basics?.basics)})`, JSON.stringify(basics?.basics) === JSON.stringify(['pepper', 'oil', 'water', 'garlic', 'spices']));

  // ---------- 4. Notes et signalement d'une recette ----------
  const [recipe] = await rest('recipes?select=id', { method: 'POST', headers: { ...admin, Prefer: 'return=representation' }, body: JSON.stringify({ user_id: a.id, title: 'Soupe de tomates', instructions: ['Cuire 20 minutes.'], ingredients_used: [{ name: 'tomates', quantity: '3', unit: '', pantry_id: null }] }) });
  await A.page.goto(APP, { waitUntil: 'networkidle2', timeout: 180_000 });
  await sleep(3500);
  await A.tap('Soupe de tomates');
  await sleep(1500);
  await A.page.evaluate(() => document.querySelectorAll('div').forEach((el) => { if (el.scrollHeight > el.clientHeight + 50) el.scrollTop = 5000; }));
  await sleep(800);
  check('fiche : « Ton avis »', await A.has('TON AVIS') || await A.has('Ton avis'));
  await A.tap('Pas pour nous');
  await sleep(1000);
  const [rated] = await rest(`recipes?id=eq.${recipe.id}&select=rating`);
  check('« Pas pour nous » enregistré', rated?.rating === 'disliked' && await A.has('ce plat ne te sera plus proposé'));
  await A.tap('Signaler un problème');
  await A.tap('Pas bon');
  await A.shot('8-signalement.png');
  await A.tap('Envoyer');
  await sleep(2500);
  const reports = await rest(`recipe_reports?user_id=eq.${a.id}&select=reason`);
  check('signalement envoyé', reports.length === 1 && reports[0].reason === 'bad' && await A.has('Merci, c’est noté.'));
  await A.shot('9-fiche-avis.png');

  // ---------- 5. Donner mon avis ----------
  await A.page.goto(APP, { waitUntil: 'networkidle2', timeout: 180_000 });
  await sleep(3000);
  await A.tap('Réglages', { last: true });
  await A.tap('Donner mon avis');
  await A.tap('Une idée');
  await A.type('textarea', 'Avis de test du parcours web');
  await A.shot('10-avis.png');
  await A.tap('Envoyer', { last: true });
  await sleep(2500);
  const feedback = await rest(`feedback?user_id=eq.${a.id}&select=kind,message,app_version,language`);
  check(`avis enregistré (${JSON.stringify(feedback[0] ?? null)})`, feedback.length === 1 && feedback[0].kind === 'idea' && await A.has('Merci !'));
  await A.context.close();

  // ---------- 6. Version courte, arrivée par une invitation ----------
  const b = await createUser('contact-b');
  users.push(b);
  const B = await openPage(b, { pending_household_invite: 'ABC234' });
  await B.page.goto(APP, { waitUntil: 'networkidle2', timeout: 180_000 });
  await sleep(3500);
  check('invitation : un seul écran « Bienvenue dans le foyer »', await B.has('Bienvenue dans le foyer') && await B.absent('Suivant'));
  await B.shot('11-invite.png');
  await B.tap('Continuer');
  await B.tap('Passer');
  await sleep(2500);
  check('invitation : « Mon foyer » ouvert avec le code', await B.has('Mon foyer') && await B.absent('Ajoute tes premiers aliments'));
  await B.shot('12-invite-foyer.png');
  await B.context.close();

  // ---------- 7. Mot de passe oublié (sans session) ----------
  const C = await openPage(null);
  await C.page.goto(APP, { waitUntil: 'networkidle2', timeout: 180_000 });
  await sleep(3000);
  await C.tap('Mot de passe oublié ?');
  await sleep(1500);
  check('écran « Mot de passe oublié »', await C.has('Indique ton adresse e-mail'));
  await C.shot('13-mot-de-passe-oublie.png');
  await C.context.close();
} catch (error) {
  console.log('ÉCHEC :', String(error?.message ?? error).slice(0, 300));
} finally {
  await browser.close();
  for (const user of users) {
    for (const table of ['feedback', 'recipe_reports']) await fetch(`${URL_}/rest/v1/${table}?user_id=eq.${user.id}`, { method: 'DELETE', headers: admin });
    console.log('compte de test supprimé :', (await fetch(`${URL_}/auth/v1/admin/users/${user.id}`, { method: 'DELETE', headers: admin })).status);
  }
  console.log('captures :', out);
}
