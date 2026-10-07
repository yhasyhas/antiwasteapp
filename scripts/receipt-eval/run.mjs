// Évaluation du mode ticket de caisse (Scanner, « Ticket ») : tickets fabriqués avec des cas piégeux (jouets au nom
// d'animal ou d'aliment, produits ménagers, plats du rayon traiteur, abréviations), photographiés par Chrome, envoyés à
// la fonction analyze-image déployée (mode receipt) avec le jeton d'un compte de test, comme l'app.
// Pour chaque cas (cases.json) :
//   - foods : aliments attendus (un des mots de chaque groupe dans un nom) ;
//   - excluded : mots qui ne doivent apparaître dans aucun nom (non alimentaire, invraisemblable) ;
//   - dishes / notDishes : aliments qui doivent être (ou ne pas être) des plats cuisinés ("kind" = "dish").
// Résultat : scripts/receipt-eval/results/<date>.json et un résumé à l'écran. Compte de test supprimé à la fin.
// Prérequis : Chrome installé, puppeteer-core disponible (npm i --no-save puppeteer-core).
// Lancement depuis la racine : node scripts/receipt-eval/run.mjs [--cases id1,id2]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = (name) => {
  const index = process.argv.indexOf(`--${name}`);
  return index > 0 ? process.argv[index + 1] : null;
};
const only = arg('cases')?.split(',');
const cases = JSON.parse(fs.readFileSync(path.join(HERE, 'cases.json'), 'utf8')).filter((c) => !only || only.includes(c.id));
const { secretKey } = await import(pathToFileURL(process.cwd() + '/scripts/recipe-eval/call.mjs').href);
const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split(/\r?\n/).filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
const URL_ = env.EXPO_PUBLIC_SUPABASE_URL, PUB = env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SECRET = secretKey();
const admin = { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' };
const normalize = (text) => ` ${String(text ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;
// Mot présent au début d'un mot du nom (« banana » dans « bananas », « fromage blanc » dans « fromage blanc 0 % »)
const mentions = (name, word) => normalize(name).includes(` ${normalize(word).trim()}`);

const receiptHtml = (c) => `<!doctype html><html><body style="margin:0;background:#ddd">
<div id="r" style="width:380px;margin:20px auto;padding:24px 20px;background:#fff;font:15px/1.6 'Courier New',monospace;color:#111">
<div style="text-align:center;font-weight:bold">${c.store}</div><hr>
${c.lines.map(([label, price]) => `<div style="display:flex;justify-content:space-between;gap:12px"><span>${label}</span><span>${price}</span></div>`).join('')}
<hr><div style="display:flex;justify-content:space-between;font-weight:bold"><span>TOTAL</span><span>${c.lines.reduce((t, [, p]) => t + Number(p.replace(',', '.')), 0).toFixed(2)}</span></div>
<div>CB VISA ****4821</div></div></body></html>`;

const email = `receipt-eval-${Date.now()}@example.com`;
let userId = null;
const results = [];
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' });
try {
  userId = (await (await fetch(`${URL_}/auth/v1/admin/users`, { method: 'POST', headers: admin, body: JSON.stringify({ email, password: `T${crypto.randomUUID()}!`, email_confirm: true }) })).json()).id;
  const link = await (await fetch(`${URL_}/auth/v1/admin/generate_link`, { method: 'POST', headers: admin, body: JSON.stringify({ type: 'magiclink', email }) })).json();
  const session = await (await fetch(`${URL_}/auth/v1/verify`, { method: 'POST', headers: { apikey: PUB, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'magiclink', token_hash: link.hashed_token ?? link.properties?.hashed_token }) })).json();
  const page = await browser.newPage();
  await page.setViewport({ width: 420, height: 800, deviceScaleFactor: 2 });

  for (const c of cases) {
    await page.setContent(receiptHtml(c));
    const image = await (await page.$('#r')).screenshot({ type: 'jpeg', quality: 80, encoding: 'base64' });
    const t0 = Date.now();
    const response = await fetch(`${URL_}/functions/v1/analyze-image`, {
      method: 'POST',
      headers: { apikey: PUB, Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_base64: image, mime_type: 'image/jpeg', language: c.language, mode: 'receipt', debug: true }),
    });
    const data = await response.json();
    const items = data.ingredients ?? [];
    const find = (group) => items.find((i) => group.some((word) => mentions(i.name, word)));
    const missing = c.foods.filter((group) => !find(group)).map((g) => g.join('/'));
    const leaked = c.excluded.filter((word) => items.some((i) => mentions(i.name, word)));
    const notDish = c.dishes.filter((group) => find(group)?.kind !== 'dish').map((g) => g.join('/'));
    const wrongDish = c.notDishes.filter((group) => find(group)?.kind === 'dish').map((g) => g.join('/'));
    const uncertain = items.filter((i) => i.confidence < (data.uncertain_below ?? 0.75)).map((i) => i.name);
    const entry = {
      id: c.id, status: response.status, ms: Date.now() - t0, provider: data.provider,
      items: items.map((i) => ({ name: i.name, kind: i.kind, confidence: i.confidence, shelf_life_days: i.shelf_life_days, storage_tip: i.storage_tip })),
      dropped_by_server: data.debug ? data.dropped ?? [] : data.dropped ?? [],
      missing, leaked, notDish, wrongDish, uncertain,
      ok: response.ok && missing.length === 0 && leaked.length === 0 && notDish.length === 0 && wrongDish.length === 0,
    };
    results.push(entry);
    console.log(`${entry.ok ? 'OK' : 'ÉCHEC'} : ${c.id} (${entry.status}, ${Math.round(entry.ms / 1000)} s, ${entry.provider}) — ${items.map((i) => `${i.name}${i.kind === 'dish' ? ' [plat]' : ''}${uncertain.includes(i.name) ? ' [incertain]' : ''}`).join(', ')}`);
    if (entry.dropped_by_server.length) console.log(`   écartés par le serveur : ${entry.dropped_by_server.map((d) => `${d.line} (${d.reason})`).join(' ; ')}`);
    for (const [label, list] of [['manquants', missing], ['non alimentaires gardés', leaked], ['plats non reconnus', notDish], ['pris à tort pour des plats', wrongDish]]) {
      if (list.length) console.log(`   ${label} : ${list.join(', ')}`);
    }
  }
} catch (error) {
  console.log('ÉCHEC :', String(error?.message ?? error).slice(0, 300));
} finally {
  await browser.close();
  if (userId) await fetch(`${URL_}/auth/v1/admin/users/${userId}`, { method: 'DELETE', headers: admin });
}

const total = (key) => results.reduce((n, r) => n + r[key].length, 0);
const summary = {
  date: new Date().toISOString(),
  cases: results.length,
  passed: results.filter((r) => r.ok).length,
  missing_foods: total('missing'),
  non_food_kept: total('leaked'),
  dishes_missed: total('notDish'),
  wrong_dishes: total('wrongDish'),
  uncertain_lines: total('uncertain'),
};
const file = path.join(HERE, 'results', `${summary.date.slice(0, 16).replace(/[:T]/g, '-')}.json`);
fs.writeFileSync(file, JSON.stringify({ summary, results }, null, 2));
console.log(`\n${summary.passed}/${summary.cases} cas réussis · aliments manquants ${summary.missing_foods} · non alimentaires gardés ${summary.non_food_kept} · plats non reconnus ${summary.dishes_missed} · plats à tort ${summary.wrong_dishes} · lignes incertaines (décochées) ${summary.uncertain_lines}`);
console.log(`résultats : ${path.relative(process.cwd(), file)}`);
