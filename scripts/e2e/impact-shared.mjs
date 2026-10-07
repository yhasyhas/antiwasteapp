// « Mon impact » dans un foyer partagé, version web : deux comptes de test dans le même foyer (invitation, comme
// l'app), chacun agit avec son propre jeton.
//   1. Seule A cuisine : chiffres « Foyer » et « Moi » identiques, « Tout vient de toi ce mois-ci » affiché.
//   2. B jette un aliment périmé : le foyer compte 1 sauvé et 1 gaspillé, A 1 sauvé, B 1 gaspillé ; message absent.
// Comptes supprimés à la fin avec leurs événements ; aucun secret affiché.
// Prérequis : app web lancée (npx expo start --web --port 8082), Chrome installé, puppeteer-core disponible
// (npm i --no-save puppeteer-core). Lancement depuis la racine : node scripts/e2e/impact-shared.mjs [dossier des captures]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';

const out = process.argv[2] ?? fs.mkdtempSync(path.join(os.tmpdir(), 'impact-shared-'));
const { secretKey } = await import(pathToFileURL(process.cwd() + '/scripts/recipe-eval/call.mjs').href);
const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split(/\r?\n/).filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
const URL_ = env.EXPO_PUBLIC_SUPABASE_URL, PUB = env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SECRET = secretKey();
const APP = 'http://localhost:8082/';
const admin = { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (label, ok) => {
  if (!ok) failures++;
  console.log(`${ok ? 'OK' : 'ÉCHEC'} : ${label}`);
};
const storageKey = `sb-${new URL(URL_).hostname.split('.')[0]}-auth-token`;

async function createUser(label) {
  const email = `${label}-${Date.now()}@example.com`;
  const id = (await (await fetch(`${URL_}/auth/v1/admin/users`, { method: 'POST', headers: admin, body: JSON.stringify({ email, password: `T${crypto.randomUUID()}!`, email_confirm: true }) })).json()).id;
  const link = await (await fetch(`${URL_}/auth/v1/admin/generate_link`, { method: 'POST', headers: admin, body: JSON.stringify({ type: 'magiclink', email }) })).json();
  const session = await (await fetch(`${URL_}/auth/v1/verify`, { method: 'POST', headers: { apikey: PUB, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'magiclink', token_hash: link.hashed_token ?? link.properties?.hashed_token }) })).json();
  await fetch(`${URL_}/rest/v1/profiles`, { method: 'POST', headers: { ...admin, Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ id, email, display_name: label, onboarded_at: new Date().toISOString() }) });
  // Appels avec le jeton de l'utilisateur (règles d'accès de l'app)
  const as = async (pathAndQuery, init = {}) => {
    const response = await fetch(`${URL_}/rest/v1/${pathAndQuery}`, { ...init, headers: { apikey: PUB, Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(init.headers ?? {}) } });
    const text = await response.text();
    if (!response.ok) throw new Error(`${pathAndQuery} : ${response.status} ${text.slice(0, 200)}`);
    return text ? JSON.parse(text) : null;
  };
  return { id, email, session, as, rpc: (name, args = {}) => as(`rpc/${name}`, { method: 'POST', body: JSON.stringify(args) }) };
}

const users = [];
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--lang=fr-FR'] });

// Écran « Mon impact » de A : texte affiché
async function impactText(user, shot) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.evaluateOnNewDocument((key, auth) => {
    if (sessionStorage.getItem('seeded')) return;
    localStorage.setItem('app_language', 'fr');
    localStorage.setItem(key, auth);
    sessionStorage.setItem('seeded', '1');
  }, storageKey, JSON.stringify({ ...user.session, expires_at: Math.floor(Date.now() / 1000) + user.session.expires_in }));
  await page.goto(APP, { waitUntil: 'networkidle2', timeout: 180_000 });
  // Compteur de l'accueil touché, comme dans l'app
  for (let waited = 0; waited < 15000; waited += 500) {
    const tapped = await page.evaluate(() => {
      const counter = [...document.querySelectorAll('[role=button]')].find((el) => (el.getAttribute('aria-label') || '').includes('Voir mon impact'));
      counter?.click();
      return Boolean(counter);
    });
    if (tapped) break;
    await sleep(500);
  }
  let text = '';
  for (let waited = 0; waited < 15000; waited += 500) {
    text = await page.evaluate(() => document.body.innerText);
    if (text.includes('Les plus gaspillés') && /\d/.test(text)) break;
    await sleep(500);
  }
  await sleep(800);
  text = await page.evaluate(() => document.body.innerText);
  await page.screenshot({ path: path.join(out, shot), fullPage: true });
  await context.close();
  return text;
}

try {
  const a = await createUser('Alice');
  const b = await createUser('Bruno');
  users.push(a, b);
  const code = (await a.rpc('create_household_invite')).code;
  await b.rpc('join_household', { p_code: code, p_transfer: false });
  const household = await a.rpc('my_household');
  check('même foyer partagé, deux membres', household.shared === true && household.members.length === 2);

  // 1. A cuisine un aliment
  const [rice] = await a.as('ingredients', { method: 'POST', body: JSON.stringify({ user_id: a.id, name: 'riz', expires_at: null }) });
  await a.rpc('cook_ingredients', { p_ids: [rice.id] });
  let impactA = await a.rpc('food_impact', { p_language: 'fr' });
  check('A seule : foyer = moi (1 sauvé)', impactA.months[0].household.saved === 1 && impactA.months[0].me.saved === 1);
  let text = await impactText(a, 'impact-a-seule.png');
  check('« Tout vient de toi ce mois-ci » affiché', text.includes('Tout vient de toi ce mois-ci'));
  check('choix Le foyer / Moi affiché (foyer partagé)', text.includes('Le foyer') && text.includes('Moi'));

  // 2. B jette un aliment périmé
  const yesterday = new Date(Date.now() - 2 * 86400_000).toISOString().slice(0, 10);
  const [cream] = await b.as('ingredients', { method: 'POST', body: JSON.stringify({ user_id: b.id, name: 'crème', expires_at: yesterday }) });
  await b.as(`ingredients?id=eq.${cream.id}`, { method: 'DELETE' });
  impactA = await a.rpc('food_impact', { p_language: 'fr' });
  const impactB = await b.rpc('food_impact', { p_language: 'fr' });
  const [hA, mA, mB] = [impactA.months[0].household, impactA.months[0].me, impactB.months[0].me];
  check(`foyer : 1 sauvé, 1 gaspillé (${JSON.stringify(hA)})`, hA.saved === 1 && hA.wasted === 1);
  check(`A : 1 sauvé, 0 gaspillé (${JSON.stringify(mA)})`, mA.saved === 1 && mA.wasted === 0);
  check(`B : 0 sauvé, 1 gaspillé (${JSON.stringify(mB)})`, mB.saved === 0 && mB.wasted === 1);
  check('B voit le même foyer que A', JSON.stringify(impactB.months[0].household) === JSON.stringify(hA));
  text = await impactText(a, 'impact-deux-membres.png');
  check('message absent quand B a aussi agi', !text.includes('Tout vient de toi'));
} catch (error) {
  failures++;
  console.log('ÉCHEC :', String(error?.message ?? error).slice(0, 300));
} finally {
  await browser.close();
  for (const user of users) {
    await fetch(`${URL_}/rest/v1/food_events?user_id=eq.${user.id}`, { method: 'DELETE', headers: admin });
    console.log('compte de test supprimé :', (await fetch(`${URL_}/auth/v1/admin/users/${user.id}`, { method: 'DELETE', headers: admin })).status);
  }
  console.log(failures ? `${failures} échec(s)` : 'tout est OK', '— captures :', out);
}
