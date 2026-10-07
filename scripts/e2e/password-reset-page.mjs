// Page « Nouveau mot de passe » du site (web/invite/reset.html, déployée par scripts/deploy-pages.mjs) : vrais liens
// de réinitialisation générés par l'API admin (aucun e-mail envoyé ; le lien est celui que contiendrait l'e-mail),
// passage par le serveur d'authentification, puis :
//   ordinateur : langue du compte, jeton retiré de l'adresse, erreurs du formulaire, mot de passe enregistré
//                (connexion réussie avec le nouveau), lien déjà utilisé refusé ;
//   téléphone Android : bouton « Ouvrir dans l'app » vers myapp://auth/reset (lien intent, session comprise) et
//                formulaire disponible aussi ;
//   lien expiré : message.
// L'adresse https://antigaspi-invite.pages.dev/reset** doit figurer dans les adresses de redirection autorisées.
// Compte de test créé par l'API admin, supprimé à la fin ; aucun secret affiché.
// Prérequis : Chrome installé, puppeteer-core disponible (npm i --no-save puppeteer-core).
// Lancement depuis la racine : node scripts/e2e/password-reset-page.mjs [dossier des captures]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';

const out = process.argv[2] ?? fs.mkdtempSync(path.join(os.tmpdir(), 'password-reset-page-'));
const { secretKey } = await import(pathToFileURL(process.cwd() + '/scripts/recipe-eval/call.mjs').href);
const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split(/\r?\n/).filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
const URL_ = env.EXPO_PUBLIC_SUPABASE_URL, SECRET = secretKey();
const PAGE = `${env.EXPO_PUBLIC_INVITE_URL.replace(/\/+$/, '')}/reset`;
const admin = { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (label, ok) => {
  if (!ok) failures++;
  console.log(`${ok ? 'OK' : 'ÉCHEC'} : ${label}`);
};
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 11; SM-A305F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';

const email = `reset-page-${Date.now()}@example.com`;
const newPassword = `N${crypto.randomUUID().slice(0, 12)}!`;
let userId = null;

// Lien de l'e-mail : la page reçoit ?lang= de l'app ; la langue du compte (es) doit l'emporter
async function recoveryLink() {
  const link = await (await fetch(`${URL_}/auth/v1/admin/generate_link`, { method: 'POST', headers: admin, body: JSON.stringify({ type: 'recovery', email, redirect_to: `${PAGE}?lang=fr` }) })).json();
  return link.action_link ?? link.properties?.action_link;
}

const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--lang=en-US'] });
try {
  userId = (await (await fetch(`${URL_}/auth/v1/admin/users`, { method: 'POST', headers: admin, body: JSON.stringify({ email, password: `T${crypto.randomUUID()}!`, email_confirm: true, user_metadata: { lang: 'es' } }) })).json()).id;
  check('compte de test créé', Boolean(userId));

  const newPage = async (mobile) => {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    if (mobile) {
      await page.setUserAgent(ANDROID_UA);
      await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    } else {
      await page.setViewport({ width: 1280, height: 800 });
    }
    const text = () => page.evaluate(() => document.body.innerText);
    const has = async (value, waitMs = 8000) => {
      for (let waited = 0; ; waited += 250) {
        if ((await text()).includes(value)) return true;
        if (waited >= waitMs) return false;
        await sleep(250);
      }
    };
    return { context, page, has };
  };

  // ---- Ordinateur ----
  const desktopLink = await recoveryLink();
  check('lien de réinitialisation vers la page du site', typeof desktopLink === 'string' && decodeURIComponent(desktopLink).includes(PAGE));
  const desktop = await newPage(false);
  // Navigateur en mode sombre : le texte saisi doit rester foncé sur les champs blancs
  await desktop.page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
  await desktop.page.goto(desktopLink, { waitUntil: 'networkidle2', timeout: 60_000 });
  check(`arrivée sur la page (${new URL(desktop.page.url()).pathname})`, desktop.page.url().startsWith(PAGE));
  check('jeton retiré de l’adresse', !desktop.page.url().includes('access_token'));
  check('langue du compte (espagnol) plutôt que ?lang=fr', await desktop.has('Nueva contraseña'));
  check('pas de bouton « Abrir en la app » sur ordinateur', !(await desktop.page.$eval('#open-block', (el) => !el.classList.contains('hidden'))));
  // Œil : le mot de passe s'affiche en clair, puis se masque de nouveau ; texte saisi foncé
  await desktop.page.type('#password', 'visible1');
  const typeOf = () => desktop.page.$eval('#password', (el) => el.type);
  await desktop.page.click('button.eye[data-for=password]');
  const shown = await typeOf();
  const label = await desktop.page.$eval('button.eye[data-for=password]', (el) => el.getAttribute('aria-label'));
  await desktop.page.click('button.eye[data-for=password]');
  check(`œil : mot de passe affiché puis masqué (${label})`, shown === 'text' && (await typeOf()) === 'password' && label === 'Ocultar la contraseña');
  check('œil sur le champ de confirmation aussi', Boolean(await desktop.page.$('button.eye[data-for=confirm]')));
  const color = await desktop.page.$eval('#password', (el) => getComputedStyle(el).webkitTextFillColor || getComputedStyle(el).color);
  check(`texte saisi foncé en mode sombre du navigateur (${color})`, color === 'rgb(21, 36, 27)');
  await desktop.page.$eval('#password', (el) => { el.value = ''; });
  await desktop.page.screenshot({ path: path.join(out, '1-ordinateur.png') });
  await desktop.page.type('#password', 'abc');
  await desktop.page.type('#confirm', 'abc');
  await desktop.page.click('#save');
  check('mot de passe trop court refusé', await desktop.has('al menos 6 caracteres'));
  await desktop.page.$eval('#password', (el) => { el.value = ''; });
  await desktop.page.$eval('#confirm', (el) => { el.value = ''; });
  await desktop.page.type('#password', newPassword);
  await desktop.page.type('#confirm', `${newPassword}x`);
  await desktop.page.click('#save');
  check('mots de passe différents refusés', await desktop.has('no coinciden'));
  await desktop.page.$eval('#confirm', (el) => { el.value = ''; });
  await desktop.page.type('#confirm', newPassword);
  await desktop.page.click('#save');
  check('nouveau mot de passe enregistré', await desktop.has('Contraseña cambiada'));
  await desktop.page.screenshot({ path: path.join(out, '2-change.png') });
  // Connexion avec le nouveau mot de passe (clé secrète : sans vérification anti-robot)
  const login = await fetch(`${URL_}/auth/v1/token?grant_type=password`, { method: 'POST', headers: admin, body: JSON.stringify({ email, password: newPassword }) });
  check(`connexion avec le nouveau mot de passe (${login.status})`, login.ok);
  // Même lien une seconde fois : déjà utilisé
  const again = await newPage(false);
  await again.page.goto(desktopLink, { waitUntil: 'networkidle2', timeout: 60_000 });
  check('lien déjà utilisé : « lien expiré »', await again.has('Enlace caducado') || await again.has('Link expired') || await again.has('Lien expiré'));
  await again.page.screenshot({ path: path.join(out, '3-deja-utilise.png') });
  await desktop.context.close();
  await again.context.close();

  // ---- Téléphone Android ----
  const mobileLink = await recoveryLink();
  const mobile = await newPage(true);
  await mobile.page.goto(mobileLink, { waitUntil: 'networkidle2', timeout: 60_000 });
  check('téléphone : bouton « Abrir en la app »', await mobile.has('Abrir en la app'));
  const href = await mobile.page.$eval('#open', (el) => el.getAttribute('href'));
  check('téléphone : lien vers myapp://auth/reset avec la session et le paquet de l’app',
    /^intent:\/\/auth\/reset\?access_token=[^&]+&refresh_token=[^&]+&type=recovery#Intent;scheme=myapp;package=com\.yhasyhas\.antiwasteapp\.dev;S\.browser_fallback_url=/.test(href ?? ''));
  check('téléphone : formulaire disponible aussi', await mobile.page.$eval('#form', (el) => !el.classList.contains('hidden')));
  await mobile.page.screenshot({ path: path.join(out, '4-telephone.png') });
  // App absente : Chrome revient sur la page (?app=absent), la session est relue, le formulaire seul est proposé
  await mobile.page.goto(`${PAGE}?lang=fr&app=absent`, { waitUntil: 'networkidle2', timeout: 60_000 });
  check('app absente : formulaire sans bouton', await mobile.has('Elige tu nueva contraseña') && !(await mobile.page.$eval('#open-block', (el) => !el.classList.contains('hidden'))));
  await mobile.context.close();

  // ---- Lien expiré (renvoyé par le serveur d'authentification) ----
  const expired = await newPage(false);
  await expired.page.goto(`${PAGE}?lang=en#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired`, { waitUntil: 'networkidle2', timeout: 60_000 });
  check('lien expiré : message (langue de l’app : ?lang=en)', await expired.has('Link expired'));
  await expired.page.screenshot({ path: path.join(out, '5-expire.png') });
  await expired.context.close();
} catch (error) {
  failures++;
  console.log('ÉCHEC :', String(error?.message ?? error).slice(0, 300));
} finally {
  await browser.close();
  if (userId) console.log('compte de test supprimé :', (await fetch(`${URL_}/auth/v1/admin/users/${userId}`, { method: 'DELETE', headers: admin })).status);
  console.log(failures ? `${failures} échec(s)` : 'tout est OK', '— captures :', out);
}
