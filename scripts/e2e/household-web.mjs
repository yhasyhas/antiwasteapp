// « Mon foyer », version web : deux comptes de test dans le même foyer (invitation, comme l'app).
//   - Fiche d'un membre (toucher le membre) : prénom, rôle, date d'arrivée, aliments ajoutés et sauvés ce mois-ci.
//   - Retirer un membre : confirmation avec son prénom et les conséquences, « Annuler » ne change rien.
//   - Quitter le foyer (propriétaire) : ce qu'on garde, ce qu'on perd, passage de propriétaire ; « Annuler ».
// Comptes supprimés à la fin avec leurs événements ; aucun secret affiché.
// Prérequis : app web lancée (npx expo start --web --port 8082), Chrome installé, puppeteer-core disponible
// (npm i --no-save puppeteer-core). Lancement depuis la racine : node scripts/e2e/household-web.mjs [dossier des captures]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';

const out = process.argv[2] ?? fs.mkdtempSync(path.join(os.tmpdir(), 'household-'));
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
  const email = `${label.toLowerCase()}-${Date.now()}@example.com`;
  const id = (await (await fetch(`${URL_}/auth/v1/admin/users`, { method: 'POST', headers: admin, body: JSON.stringify({ email, password: `T${crypto.randomUUID()}!`, email_confirm: true }) })).json()).id;
  const link = await (await fetch(`${URL_}/auth/v1/admin/generate_link`, { method: 'POST', headers: admin, body: JSON.stringify({ type: 'magiclink', email }) })).json();
  const session = await (await fetch(`${URL_}/auth/v1/verify`, { method: 'POST', headers: { apikey: PUB, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'magiclink', token_hash: link.hashed_token ?? link.properties?.hashed_token }) })).json();
  await fetch(`${URL_}/rest/v1/profiles`, { method: 'POST', headers: { ...admin, Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ id, email, display_name: label, onboarded_at: new Date().toISOString() }) });
  const rpc = async (name, args = {}) => {
    const response = await fetch(`${URL_}/rest/v1/rpc/${name}`, { method: 'POST', headers: { apikey: PUB, Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(args) });
    const text = await response.text();
    if (!response.ok) throw new Error(`${name} : ${response.status} ${text.slice(0, 200)}`);
    return text ? JSON.parse(text) : null;
  };
  return { id, email, session, rpc };
}

const users = [];
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--lang=fr-FR'] });
try {
  const alice = await createUser('Alice');
  const bruno = await createUser('Bruno');
  users.push(alice, bruno);
  await bruno.rpc('join_household', { p_code: (await alice.rpc('create_household_invite')).code, p_transfer: false });
  // Bruno ajoute 2 aliments (comme le scan ou la saisie : historique « ajouté ») et en cuisine 1
  await bruno.rpc('add_pantry_items', { p_items: [{ name: 'riz', quantity: '1 kg' }, { name: 'tomates', quantity: '4' }] });
  const pantry = await (await fetch(`${URL_}/rest/v1/ingredients?select=id,name&user_id=eq.${bruno.id}`, { headers: admin })).json();
  await bruno.rpc('cook_ingredients', { p_ids: pantry.filter((i) => i.name === 'riz').map((i) => i.id) });

  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.evaluateOnNewDocument((key, auth) => {
    if (sessionStorage.getItem('seeded')) return;
    localStorage.setItem('app_language', 'fr');
    localStorage.setItem(key, auth);
    sessionStorage.setItem('seeded', '1');
  }, storageKey, JSON.stringify({ ...alice.session, expires_at: Math.floor(Date.now() / 1000) + alice.session.expires_in }));
  const text = () => page.evaluate(() => document.body.innerText);
  const has = async (value, waitMs = 8000) => {
    for (let waited = 0; ; waited += 400) {
      if ((await text()).includes(value)) return true;
      if (waited >= waitMs) return false;
      await sleep(400);
    }
  };
  const tap = async (label) => {
    for (let waited = 0; waited < 10000; waited += 400) {
      const ok = await page.evaluate((l) => {
        const hits = [...document.querySelectorAll('[role=button],[role=tab],[role=link]')]
          .filter((el) => el.getClientRects().length > 0)
          .filter((el) => [el.innerText, el.getAttribute('aria-label')].some((v) => (v || '').trim().startsWith(l)));
        hits.at(-1)?.click();
        return hits.length > 0;
      }, label);
      if (ok) return sleep(900);
      await sleep(400);
    }
    throw new Error(`introuvable : « ${label} »`);
  };

  await page.goto(APP, { waitUntil: 'networkidle2', timeout: 180_000 });
  await tap('Réglages');
  await tap('Mon foyer');
  check('« Mon foyer » : deux membres', await has('Bruno'));

  // Fiche membre
  await tap('Bruno, voir sa fiche');
  check('fiche : rôle et date d’arrivée', await has('Dans le foyer depuis le') && (await text()).includes('Membre'));
  const sheet = await text();
  check('fiche : 2 aliments ajoutés et 1 sauvé ce mois-ci', /2\s*aliments ajoutés/.test(sheet) && /1\s*aliment sauvé/.test(sheet));
  await page.screenshot({ path: path.join(out, '1-fiche-membre.png') });
  await tap('Fermer');

  // Retirer un membre : confirmation, puis « Annuler »
  await tap('Retirer Bruno');
  check('retrait : prénom dans la question', await has('Retirer Bruno du foyer ?'));
  check('retrait : conséquences expliquées', (await text()).includes('Les aliments ajoutés par Bruno restent dans le foyer'));
  await page.screenshot({ path: path.join(out, '2-retrait.png') });
  await tap('Annuler');
  const afterCancel = await alice.rpc('my_household');
  check('« Annuler » : Bruno toujours membre', afterCancel.members.length === 2);

  // Quitter le foyer (Alice est propriétaire) : confirmation, puis « Annuler »
  await tap('Quitter le foyer');
  check('départ : ce qu’on garde', await has('Tu gardes :'));
  const leaving = await text();
  check('départ : ce qu’on perd', leaving.includes('Tu perds :'));
  check('départ : nouveau propriétaire annoncé', leaving.includes('deviendra propriétaire'));
  await page.screenshot({ path: path.join(out, '3-depart.png') });
  await tap('Annuler');
  check('« Annuler » : Alice toujours dans le foyer', (await alice.rpc('my_household')).shared === true);
  await context.close();
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
