// Ticket de caisse (Scanner, mode « Ticket ») : un ticket fabriqué (libellés abrégés, produits alimentaires et non
// alimentaires, total, TVA, paiement) est photographié par Chrome puis envoyé à analyze-image en mode receipt, avec le
// jeton d'un compte de test (comme l'app). Vérifie : aliments décodés en noms génériques, non-alimentaire ignoré,
// totaux ignorés, durées de conservation pour les dates estimées. Langue : argument (fr par défaut).
// Compte de test créé par l'API admin, supprimé à la fin ; aucun secret affiché.
// Prérequis : Chrome installé, puppeteer-core disponible (npm i --no-save puppeteer-core).
// Lancement depuis la racine : node scripts/e2e/receipt-scan.mjs [fr|en|es]
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';

const language = process.argv[2] ?? 'fr';
const { secretKey } = await import(pathToFileURL(process.cwd() + '/scripts/recipe-eval/call.mjs').href);
const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split(/\r?\n/).filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
const URL_ = env.EXPO_PUBLIC_SUPABASE_URL, PUB = env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SECRET = secretKey();
const admin = { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' };
let failures = 0;
const check = (label, ok) => {
  if (!ok) failures++;
  console.log(`${ok ? 'OK' : 'ÉCHEC'} : ${label}`);
};
const normalize = (text) => String(text ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// Ticket : 6 aliments (dont un en deux lignes), 3 produits non alimentaires, totaux et paiement
const LINES = [
  ['TOM GRAPPE 1KG', '2,49'], ['LAIT DEMI-ECR 1L', '0,99'], ['LAIT DEMI-ECR 1L', '0,99'], ['FILET POULET X2 400G', '5,90'],
  ['LESSIVE LIQ 2L', '7,45'], ['YAOURT NAT X8', '1,85'], ['SAVON MAINS 300ML', '2,10'], ['COURGETTE VRAC 0,612KG', '1,47'],
  ['SAC CABAS', '0,10'], ['PAIN COMPLET 500G', '2,20'],
];
const html = `<!doctype html><html><body style="margin:0;background:#ddd">
<div id="r" style="width:360px;margin:20px auto;padding:24px 20px;background:#fff;font:15px/1.6 'Courier New',monospace;color:#111">
<div style="text-align:center;font-weight:bold">SUPERMARCHE DU CENTRE</div><div style="text-align:center">12 RUE DES LILAS 75011 PARIS</div><hr>
${LINES.map(([label, price]) => `<div style="display:flex;justify-content:space-between"><span>${label}</span><span>${price}</span></div>`).join('')}
<hr><div style="display:flex;justify-content:space-between;font-weight:bold"><span>TOTAL</span><span>25,54 EUR</span></div>
<div style="display:flex;justify-content:space-between"><span>CB VISA</span><span>25,54</span></div>
<div>TVA 5,5% 1,02 &nbsp; TVA 20% 1,61</div><div style="text-align:center">MERCI DE VOTRE VISITE</div></div></body></html>`;

const email = `receipt-${Date.now()}@example.com`;
let userId = null;
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' });
try {
  userId = (await (await fetch(`${URL_}/auth/v1/admin/users`, { method: 'POST', headers: admin, body: JSON.stringify({ email, password: `T${crypto.randomUUID()}!`, email_confirm: true }) })).json()).id;
  const link = await (await fetch(`${URL_}/auth/v1/admin/generate_link`, { method: 'POST', headers: admin, body: JSON.stringify({ type: 'magiclink', email }) })).json();
  const session = await (await fetch(`${URL_}/auth/v1/verify`, { method: 'POST', headers: { apikey: PUB, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'magiclink', token_hash: link.hashed_token ?? link.properties?.hashed_token }) })).json();

  const page = await browser.newPage();
  await page.setViewport({ width: 400, height: 700, deviceScaleFactor: 2 });
  await page.setContent(html);
  const image = await (await page.$('#r')).screenshot({ type: 'jpeg', quality: 80, encoding: 'base64' });

  const t0 = Date.now();
  const response = await fetch(`${URL_}/functions/v1/analyze-image`, {
    method: 'POST',
    headers: { apikey: PUB, Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_base64: image, mime_type: 'image/jpeg', language, mode: 'receipt' }),
  });
  const data = await response.json();
  const items = data.ingredients ?? [];
  console.log(`réponse ${response.status} en ${Math.round((Date.now() - t0) / 1000)} s : ${items.map((i) => `${i.name} (${i.quantity || '—'}, ${i.shelf_life_days ?? '?'} j)`).join(' ; ')}`);
  const names = items.map((i) => normalize(i.name));
  const found = (words) => names.some((name) => words.some((word) => name.includes(word)));
  check('ticket lu (200)', response.ok);
  check('tomates', found(['tomat']));
  check('lait, une seule fois', names.filter((name) => ['lait', 'milk', 'leche'].some((w) => name.includes(w))).length === 1);
  check('poulet', found(['poulet', 'chicken', 'pollo']));
  check('yaourt', found(['yaourt', 'yogurt', 'yogur']));
  check('courgette', found(['courgette', 'zucchini', 'calabacin']));
  check('pain', found(['pain', 'bread', 'pan']));
  check('lessive, savon et sac ignorés', !found(['lessive', 'detergent', 'savon', 'soap', 'jabon', 'sac', 'bag', 'bolsa']));
  check('total, TVA et paiement ignorés', !found(['total', 'tva', 'visa', 'cb']));
  check('durée de conservation pour chaque aliment (dates estimées)', items.length > 0 && items.every((i) => Number.isFinite(i.shelf_life_days)));
} catch (error) {
  failures++;
  console.log('ÉCHEC :', String(error?.message ?? error).slice(0, 300));
} finally {
  await browser.close();
  if (userId) console.log('compte de test supprimé :', (await fetch(`${URL_}/auth/v1/admin/users/${userId}`, { method: 'DELETE', headers: admin })).status);
  console.log(failures ? `${failures} échec(s)` : 'tout est OK');
}
