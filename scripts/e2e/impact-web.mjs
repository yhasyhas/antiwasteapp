// « Mon impact », version web : compteur de l'accueil touché, ce mois-ci, 6 derniers mois, aliments les plus gaspillés
// avec le conseil de leur fiche (oignon : fiche existante), trois langues (titre). Événements créés pour un compte de
// test (clé secrète), supprimés avec lui à la fin ; aucun secret affiché.
// Prérequis : app web lancée (npx expo start --web --port 8082), Chrome installé, puppeteer-core disponible
// (npm i --no-save puppeteer-core). Lancement depuis la racine : node scripts/e2e/impact-web.mjs [dossier des captures]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';

const out = process.argv[2] ?? fs.mkdtempSync(path.join(os.tmpdir(), 'impact-'));
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
const rest = async (pathAndQuery, init = {}) => {
  const text = await (await fetch(`${URL_}/rest/v1/${pathAndQuery}`, { headers: admin, ...init })).text();
  return text ? JSON.parse(text) : null;
};

const email = `impact-${Date.now()}@example.com`;
let userId = null;
let householdId = null;
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--lang=fr-FR'] });
try {
  userId = (await (await fetch(`${URL_}/auth/v1/admin/users`, { method: 'POST', headers: admin, body: JSON.stringify({ email, password: `T${crypto.randomUUID()}!`, email_confirm: true }) })).json()).id;
  const link = await (await fetch(`${URL_}/auth/v1/admin/generate_link`, { method: 'POST', headers: admin, body: JSON.stringify({ type: 'magiclink', email }) })).json();
  const session = await (await fetch(`${URL_}/auth/v1/verify`, { method: 'POST', headers: { apikey: PUB, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'magiclink', token_hash: link.hashed_token ?? link.properties?.hashed_token }) })).json();
  // Compte existant : guide du premier lancement déjà passé
  await rest('profiles', { method: 'POST', headers: { ...admin, Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ id: userId, email, onboarded_at: new Date().toISOString() }) });
  householdId = (await rest(`household_members?select=household_id&user_id=eq.${userId}`))[0]?.household_id;
  check('foyer du compte de test', Boolean(householdId));
  // Ce mois-ci : 3 sauvés, 2 oignons gaspillés ; il y a 2 mois : 1 sauvé
  const twoMonthsAgo = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 2, 10)).toISOString();
  const events = [
    ...['riz', 'tomates', 'lait'].map((name) => ({ kind: 'saved', ingredient_name: name })),
    { kind: 'wasted', ingredient_name: 'Oignon' }, { kind: 'wasted', ingredient_name: 'oignons' },
    { kind: 'saved', ingredient_name: 'pain', created_at: twoMonthsAgo },
    // Insertion groupée : mêmes champs pour toutes les lignes
  ].map((event) => ({ household_id: householdId, user_id: userId, created_at: new Date().toISOString(), ...event }));
  await rest('food_events', { method: 'POST', body: JSON.stringify(events) });

  for (const [language, title] of [['fr', 'Mon impact'], ['en', 'My impact'], ['es', 'Mi impacto']]) {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await page.evaluateOnNewDocument((key, auth, lang) => {
      if (sessionStorage.getItem('seeded')) return;
      localStorage.setItem('app_language', lang);
      localStorage.setItem(key, auth);
      sessionStorage.setItem('seeded', '1');
    }, storageKey, JSON.stringify({ ...session, expires_at: Math.floor(Date.now() / 1000) + session.expires_in }), language);
    const has = async (value, waitMs = 10000) => {
      for (let waited = 0; ; waited += 500) {
        if ((await page.evaluate(() => document.body.innerText)).includes(value)) return true;
        if (waited >= waitMs) return false;
        await sleep(500);
      }
    };
    await page.goto(APP, { waitUntil: 'networkidle2', timeout: 180_000 });
    // Compteur de l'accueil : toucher ouvre « Mon impact »
    for (let waited = 0; waited < 15000; waited += 500) {
      const tapped = await page.evaluate(() => {
        const counter = [...document.querySelectorAll('[role=button]')].find((el) => /^3\s/.test(el.getAttribute('aria-label') || ''));
        counter?.click();
        return Boolean(counter);
      });
      if (tapped) break;
      await sleep(500);
    }
    check(`${language} : écran « ${title} »`, await has(title));
    if (language === 'fr') {
      // Données chargées (la liste des plus gaspillés arrive avec le reste)
      await has('jeté');
      const text = await page.evaluate(() => document.body.innerText);
      check('fr : ce mois-ci, 3 sauvés et 2 gaspillés', /Ce mois-ci[\s\S]*3[\s\S]*aliments sauvés[\s\S]*2[\s\S]*gaspillés/i.test(text));
      check('fr : 6 mois listés', (text.match(/\b20\d\d\b/g) ?? []).length >= 6);
      check('fr : pas de choix foyer / moi (foyer non partagé)', !text.includes('Le foyer\nMoi'));
      check('fr : oignon le plus gaspillé (2 fois), regroupé malgré le pluriel', /Oignon[\s\S]{0,40}jeté 2 fois/.test(text));
      check('fr : conseil tiré de la fiche', await has('Conserver', 4000));
      await page.screenshot({ path: path.join(out, 'impact-fr.png'), fullPage: true });
    }
    await context.close();
  }
} catch (error) {
  failures++;
  console.log('ÉCHEC :', String(error?.message ?? error).slice(0, 300));
} finally {
  await browser.close();
  if (householdId) await rest(`food_events?household_id=eq.${householdId}`, { method: 'DELETE' });
  if (userId) console.log('compte de test supprimé :', (await fetch(`${URL_}/auth/v1/admin/users/${userId}`, { method: 'DELETE', headers: admin })).status);
  console.log(failures ? `${failures} échec(s)` : 'tout est OK', '— captures :', out);
}
