// Mot de passe oublié, version web : lien de réinitialisation généré par l'API admin (aucun e-mail envoyé ; le lien
// est celui que contiendrait l'e-mail), ouverture de « Nouveau mot de passe » et enregistrement ; lien expiré : message et retour à « Mot de passe oublié ».
// L'adresse http://localhost:8082/** doit figurer dans les adresses de redirection autorisées (docs/ENVIRONMENT.md).
// Compte de test créé par l'API admin, supprimé à la fin ; aucun secret affiché.
// Prérequis : app web lancée (npx expo start --web --port 8082), Chrome installé, puppeteer-core disponible
// (npm i --no-save puppeteer-core). Lancement depuis la racine : node scripts/e2e/password-reset-web.mjs [dossier des captures]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';

const out = process.argv[2] ?? fs.mkdtempSync(path.join(os.tmpdir(), 'password-reset-'));
const { secretKey } = await import(pathToFileURL(process.cwd() + '/scripts/recipe-eval/call.mjs').href);
const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split(/\r?\n/).filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const URL_ = env.EXPO_PUBLIC_SUPABASE_URL, PUB = env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SECRET = secretKey();
const APP = 'http://localhost:8082/';
const admin = { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (label, ok) => console.log(`${ok ? 'OK' : 'ÉCHEC'} : ${label}`);

const email = `reset-${Date.now()}@example.com`;
const newPassword = `N${crypto.randomUUID().slice(0, 12)}!`;
let userId = null;
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--lang=fr-FR'] });
try {
  userId = (await (await fetch(`${URL_}/auth/v1/admin/users`, { method: 'POST', headers: admin, body: JSON.stringify({ email, password: `T${crypto.randomUUID()}!`, email_confirm: true }) })).json()).id;
  // Comptes existants : le guide du premier lancement est déjà passé
  await fetch(`${URL_}/rest/v1/profiles`, { method: 'POST', headers: { ...admin, Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ id: userId, email, onboarded_at: new Date().toISOString() }) });
  const link = await (await fetch(`${URL_}/auth/v1/admin/generate_link`, { method: 'POST', headers: admin, body: JSON.stringify({ type: 'recovery', email, redirect_to: `${APP}auth/reset` }) })).json();
  const actionLink = link.action_link ?? link.properties?.action_link;
  check('lien de réinitialisation obtenu, vers l’écran de l’app', typeof actionLink === 'string' && decodeURIComponent(actionLink).includes(`${APP}auth/reset`));

  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.evaluateOnNewDocument(() => localStorage.setItem('app_language', 'fr'));
  const has = async (value, waitMs = 8000) => {
    for (let waited = 0; ; waited += 500) {
      if ((await page.evaluate(() => document.body.innerText)).includes(value)) return true;
      if (waited >= waitMs) return false;
      await sleep(500);
    }
  };

  // Lien de l'e-mail : le serveur d'authentification vérifie le jeton et renvoie vers l'app
  await page.goto(actionLink, { waitUntil: 'networkidle2', timeout: 180_000 });
  check(`retour vers l'app (${new URL(page.url()).pathname})`, page.url().startsWith(`${APP}auth/reset`));
  check('écran « Nouveau mot de passe »', await has('Choisis ton nouveau mot de passe'));
  await page.screenshot({ path: path.join(out, '1-nouveau-mot-de-passe.png') });
  const inputs = await page.$$('input[type=password]');
  await inputs[0].type(newPassword);
  await inputs[1].type(newPassword);
  await page.evaluate(() => [...document.querySelectorAll('[role=button]')].find((el) => (el.innerText || '').trim() === 'Enregistrer')?.click());
  // Affiché seulement si le serveur a accepté le nouveau mot de passe (updateUser). La connexion ne peut pas être
  // essayée ici : la protection anti-robot l'exige avant même de vérifier le mot de passe
  check('nouveau mot de passe accepté par le serveur', await has('Mot de passe changé'));
  await page.screenshot({ path: path.join(out, '2-mot-de-passe-change.png') });

  // Lien expiré ou déjà utilisé
  await page.goto(`${APP}auth/reset#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired`, { waitUntil: 'networkidle2', timeout: 180_000 });
  check('lien expiré : message', await has('Lien expiré'));
  await page.screenshot({ path: path.join(out, '3-lien-expire.png') });
  await context.close();
} catch (error) {
  console.log('ÉCHEC :', String(error?.message ?? error).slice(0, 300));
} finally {
  await browser.close();
  if (userId) console.log('compte de test supprimé :', (await fetch(`${URL_}/auth/v1/admin/users/${userId}`, { method: 'DELETE', headers: admin })).status);
  console.log('captures :', out);
}
