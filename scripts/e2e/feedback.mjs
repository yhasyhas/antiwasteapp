// Avis et signalements de bout en bout (fonction send-feedback) : un avis, une recette signalée « dangereuse » et une
// « pas bonne », une demande invalide ; vérifie les lignes en base et l'arrivée des événements dans Sentry (environnement
// « test », grâce à la clé secrète : les vraies alertes ne sont pas mélangées aux essais).
// Compte de test créé par l'API admin (aucun e-mail envoyé), supprimé à la fin (avis et signalements gardent un
// user_id vide) ; aucun secret affiché. Lancement depuis la racine : node scripts/e2e/feedback.mjs
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const { secretKey } = await import(pathToFileURL(process.cwd() + '/scripts/recipe-eval/call.mjs').href);
const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split(/\r?\n/).filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const URL_ = env.EXPO_PUBLIC_SUPABASE_URL, PUB = env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SECRET = secretKey();
const admin = { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' };
const check = (label, ok) => console.log(`${ok ? 'OK' : 'ÉCHEC'} : ${label}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const marker = `essai-${Date.now()}`;

const email = `feedback-${Date.now()}@example.com`;
let userId = null;
try {
  userId = (await (await fetch(`${URL_}/auth/v1/admin/users`, { method: 'POST', headers: admin, body: JSON.stringify({ email, password: `T${crypto.randomUUID()}!`, email_confirm: true }) })).json()).id;
  const link = await (await fetch(`${URL_}/auth/v1/admin/generate_link`, { method: 'POST', headers: admin, body: JSON.stringify({ type: 'magiclink', email }) })).json();
  const session = await (await fetch(`${URL_}/auth/v1/verify`, { method: 'POST', headers: { apikey: PUB, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'magiclink', token_hash: link.hashed_token ?? link.properties?.hashed_token }) })).json();
  const asUser = { apikey: PUB, Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' };
  await fetch(`${URL_}/rest/v1/profiles`, { method: 'POST', headers: asUser, body: JSON.stringify({ id: userId, email }) });
  const [recipe] = await (await fetch(`${URL_}/rest/v1/recipes?select=id`, { method: 'POST', headers: { ...asUser, Prefer: 'return=representation' }, body: JSON.stringify({ user_id: userId, title: `Poulet mal cuit (${marker})`, instructions: ['Cuire 2 minutes.'] }) })).json();

  const call = async (body) => {
    const response = await fetch(`${URL_}/functions/v1/send-feedback`, { method: 'POST', headers: { ...asUser, 'x-simulate-key': SECRET }, body: JSON.stringify(body) });
    return { status: response.status, data: await response.json() };
  };
  const feedback = await call({ type: 'feedback', kind: 'idea', message: `Avis de test (${marker})`, app_version: '1.0.0', device: 'samsung SM-A305F', os: 'android 11', language: 'fr' });
  check(`avis enregistré (${feedback.status})`, feedback.status === 200);
  const dangerous = await call({ type: 'recipe_report', recipe_id: recipe.id, reason: 'dangerous', comment: 'Volaille cuite 2 minutes', language: 'fr' });
  check(`signalement « dangereux » (${dangerous.status})`, dangerous.status === 200);
  const bad = await call({ type: 'recipe_report', recipe_id: recipe.id, reason: 'bad', language: 'fr' });
  check(`signalement « pas bon » (${bad.status})`, bad.status === 200);
  const invalid = await call({ type: 'feedback', kind: 'spam', message: 'x' });
  check(`demande invalide refusée (${invalid.status})`, invalid.status === 400);
  const unknownRecipe = await call({ type: 'recipe_report', recipe_id: '00000000-0000-4000-a000-000000000000', reason: 'bad' });
  check(`recette inconnue refusée (${unknownRecipe.status})`, unknownRecipe.status === 404);

  const rows = await (await fetch(`${URL_}/rest/v1/recipe_reports?user_id=eq.${userId}&select=reason,recipe_snapshot`, { headers: admin })).json();
  check('signalements en base, avec la copie de la recette', rows.length === 2 && rows.every((row) => String(row.recipe_snapshot?.title).includes(marker)));
  const saved = await (await fetch(`${URL_}/rest/v1/feedback?user_id=eq.${userId}&select=kind,device,language`, { headers: admin })).json();
  check(`avis en base (${JSON.stringify(saved)})`, saved.length === 1 && saved[0].device === 'samsung SM-A305F');

  // Événements Sentry (lecture seule) : l'avis et la recette dangereuse, pas la « pas bonne »
  const token = process.env.SENTRY_ACCESS_TOKEN;
  if (!token) console.log('SENTRY_ACCESS_TOKEN absent : arrivée dans Sentry non vérifiée');
  else {
    let titles = [];
    for (let attempt = 0; attempt < 12 && titles.length < 2; attempt++) {
      await sleep(5000);
      const issues = await (await fetch(`https://de.sentry.io/api/0/projects/yhasral/react-native/issues/?query=${encodeURIComponent(`${marker} environment:test`)}&statsPeriod=24h`, { headers: { Authorization: `Bearer ${token}` } })).json();
      titles = Array.isArray(issues) ? issues.map((issue) => issue.title) : [];
    }
    check(`avis et recette dangereuse arrivés dans Sentry (${titles.length})`, titles.some((t) => t.startsWith('Avis (Idée)')) && titles.some((t) => t.startsWith('Recette signalée dangereuse')));
  }
} catch (error) {
  console.log('ÉCHEC :', String(error?.message ?? error).slice(0, 300));
} finally {
  if (userId) {
    // Avis et signalements du compte de test d'abord (ils resteraient en base, sans utilisateur), puis le compte
    for (const table of ['feedback', 'recipe_reports']) {
      await fetch(`${URL_}/rest/v1/${table}?user_id=eq.${userId}`, { method: 'DELETE', headers: admin });
    }
    console.log('compte de test supprimé :', (await fetch(`${URL_}/auth/v1/admin/users/${userId}`, { method: 'DELETE', headers: admin })).status);
  }
}
