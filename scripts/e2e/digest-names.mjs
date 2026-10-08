// Résumé quotidien (fonction daily-digest déployée) : noms des aliments dans la langue de l'utilisateur, comme l'app.
// Compte de test (API admin) avec un appareil en anglais (jeton factice) et, périmant aujourd'hui :
//   - « saumon » relié à sa fiche (salmon) → « salmon » ;
//   - un produit de marque scanné (code-barres) → son nom, inchangé ;
//   - « fonio » sans fiche → « fonio » ;
// puis un appareil en espagnol → « salmón ». Mode d'essai « preview » : textes renvoyés, aucune notification envoyée.
// Compte supprimé à la fin ; aucun secret affiché. Lancement depuis la racine : node scripts/e2e/digest-names.mjs
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const { secretKey } = await import(pathToFileURL(process.cwd() + '/scripts/recipe-eval/call.mjs').href);
const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split(/\r?\n/).filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
const URL_ = env.EXPO_PUBLIC_SUPABASE_URL, PUB = env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SECRET = secretKey();
const admin = { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' };
const BRAND = 'Saumon fumé Zzmarque';
let failures = 0;
const check = (label, ok) => {
  if (!ok) failures++;
  console.log(`${ok ? 'OK' : 'ÉCHEC'} : ${label}`);
};

const email = `digest-names-${Date.now()}@example.com`;
let userId = null;
try {
  userId = (await (await fetch(`${URL_}/auth/v1/admin/users`, { method: 'POST', headers: admin, body: JSON.stringify({ email, password: `T${crypto.randomUUID()}!`, email_confirm: true }) })).json()).id;
  const link = await (await fetch(`${URL_}/auth/v1/admin/generate_link`, { method: 'POST', headers: admin, body: JSON.stringify({ type: 'magiclink', email }) })).json();
  const session = await (await fetch(`${URL_}/auth/v1/verify`, { method: 'POST', headers: { apikey: PUB, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'magiclink', token_hash: link.hashed_token ?? link.properties?.hashed_token }) })).json();
  const asUser = { apikey: PUB, Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' };
  // Profil (créé par l'app à la première connexion)
  await fetch(`${URL_}/rest/v1/profiles`, { method: 'POST', headers: { ...admin, Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ id: userId, email, display_name: 'Essai', onboarded_at: new Date().toISOString() }) });
  const timezone = 'Africa/Dakar';
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date());

  const added = await fetch(`${URL_}/rest/v1/rpc/add_pantry_items`, {
    method: 'POST',
    headers: asUser,
    body: JSON.stringify({ p_items: [
      { name: 'saumon', food_key: 'salmon', kind: 'ingredient', category: 'fish', location: 'fridge', expires_at: today },
      { name: BRAND, food_key: 'salmon', kind: 'ingredient', category: 'fish', location: 'fridge', expires_at: today, barcode: '0000000000017', added_via: 'barcode' },
      { name: 'fonio', kind: 'ingredient', category: 'grain', location: 'pantry', expires_at: today },
    ] }),
  });
  check(`aliments ajoutés (${added.status}${added.ok ? '' : ` ${(await added.text()).slice(0, 160)}`})`, added.ok);

  const preview = async (language) => {
    // Un résumé par jour et par utilisateur : celui de l'aperçu précédent (compte de test) est retiré
    await fetch(`${URL_}/rest/v1/daily_digests?user_id=eq.${userId}`, { method: 'DELETE', headers: admin });
    await fetch(`${URL_}/rest/v1/push_tokens?user_id=eq.${userId}`, { method: 'DELETE', headers: admin });
    await fetch(`${URL_}/rest/v1/push_tokens`, { method: 'POST', headers: admin, body: JSON.stringify({ token: `ExponentPushToken[essai-${Date.now()}]`, user_id: userId, platform: 'android', timezone, language }) });
    const response = await fetch(`${URL_}/functions/v1/daily-digest`, { method: 'POST', headers: { ...admin, 'x-simulate-key': SECRET }, body: JSON.stringify({ simulate: { user_id: userId, force: true, preview: true } }) });
    const data = await response.json();
    return data.previews?.find((p) => p.user_id === userId)?.body ?? `(HTTP ${response.status} ${JSON.stringify(data).slice(0, 120)})`;
  };

  const en = await preview('en');
  console.log('   en :', en);
  check('anglais : « saumon » devient « salmon »', /\bsalmon\b/.test(en) && !/\bsaumon\b/.test(en));
  check('anglais : le produit de marque garde son nom', en.includes(BRAND));
  check('anglais : « fonio » (sans fiche) garde son nom', en.includes('fonio'));
  const es = await preview('es');
  console.log('   es :', es);
  check('espagnol : « salmón »', es.includes('salmón'));
} catch (error) {
  failures++;
  console.log('ÉCHEC :', String(error?.message ?? error).slice(0, 300));
} finally {
  if (userId) {
    await fetch(`${URL_}/rest/v1/push_tokens?user_id=eq.${userId}`, { method: 'DELETE', headers: admin });
    await fetch(`${URL_}/rest/v1/daily_digests?user_id=eq.${userId}`, { method: 'DELETE', headers: admin });
    console.log('compte de test supprimé :', (await fetch(`${URL_}/auth/v1/admin/users/${userId}`, { method: 'DELETE', headers: admin })).status);
  }
  console.log(failures ? `${failures} échec(s)` : 'tout est OK');
}
