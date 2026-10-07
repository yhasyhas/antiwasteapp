// Page d'invitation du site (web/invite/index.html, déployée par scripts/deploy-pages.mjs), version en ligne :
//   téléphone Android : « Ouvrir l'app » est un lien intent qui vise seulement l'app de test (paquet .preview,
//                       phase 10b), avec la page d'installation du build de test si l'app est absente ;
//   ordinateur : lien myapp://join?code=… ; bouton de téléchargement vers la page d'installation.
// Aucun compte ni secret. Prérequis : Chrome installé, puppeteer-core disponible (npm i --no-save puppeteer-core).
// Lancement depuis la racine : node scripts/e2e/invite-page.mjs
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split(/\r?\n/).filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
const PAGE = `${env.EXPO_PUBLIC_INVITE_URL.replace(/\/+$/, '')}/?code=ABC234`;
const PACKAGE = 'com.yhasyhas.antiwasteapp.preview';
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 11; SM-A305F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';
let failures = 0;
const check = (label, ok) => {
  if (!ok) failures++;
  console.log(`${ok ? 'OK' : 'ÉCHEC'} : ${label}`);
};

const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' });
try {
  const page = await browser.newPage();
  const links = () => page.evaluate(() => ({ open: document.getElementById('open')?.getAttribute('href'), download: document.getElementById('download')?.getAttribute('href') }));

  await page.setUserAgent(ANDROID_UA);
  await page.goto(PAGE, { waitUntil: 'networkidle2' });
  const android = await links();
  const fallback = decodeURIComponent(/S\.browser_fallback_url=([^;]+)/.exec(android.open ?? '')?.[1] ?? '');
  check('Android : lien intent vers l’app de test (paquet .preview)', (android.open ?? '').startsWith('intent://join?code=ABC234#Intent;scheme=myapp;') && android.open.includes(`;package=${PACKAGE};`));
  check('Android : app absente → page d’installation du build de test', /^https:\/\/expo\.dev\/accounts\/yhasyhas\/projects\/[^/]+\/builds\/[0-9a-f-]{36}$/.test(fallback));
  check('Android : bouton de téléchargement vers le même build', android.download === fallback);

  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36');
  await page.goto(PAGE, { waitUntil: 'networkidle2' });
  check('ordinateur : lien myapp://join', (await links()).open === 'myapp://join?code=ABC234');
} catch (error) {
  failures++;
  console.log('ÉCHEC :', String(error?.message ?? error).slice(0, 300));
} finally {
  await browser.close();
  console.log(failures ? `${failures} échec(s)` : 'tout est OK');
}
