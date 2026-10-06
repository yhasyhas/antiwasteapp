// Envoi réel de l'e-mail « Mot de passe oublié » (SMTP personnalisé, modèles de scripts/email-templates/) à une
// adresse de test, dans une ou plusieurs langues. Si l'adresse n'a pas de compte, un compte temporaire est créé par
// l'API admin puis supprimé à la fin ; un compte existant n'est pas modifié, sauf sa langue d'e-mail (remise ensuite).
// L'appel se fait avec la clé secrète, qui dispense de la vérification anti-robot. Aucun secret affiché.
// Supabase attend 60 s entre deux e-mails au même compte (smtp_max_frequency) : le script attend entre les langues.
// Lancement depuis la racine : node scripts/e2e/recovery-email.mjs adresse@exemple.com [fr,en,es]
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const [email, langsArg = 'fr'] = process.argv.slice(2);
if (!email?.includes('@')) throw new Error('adresse manquante');
const langs = langsArg.split(',');
const { secretKey } = await import(pathToFileURL(process.cwd() + '/scripts/recipe-eval/call.mjs').href);
const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split(/\r?\n/).filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const URL_ = env.EXPO_PUBLIC_SUPABASE_URL, SECRET = secretKey();
const admin = { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Compte de l'adresse : recherche page par page (peu de comptes en développement)
async function findUser() {
  for (let page = 1; ; page++) {
    const { users = [] } = await (await fetch(`${URL_}/auth/v1/admin/users?page=${page}&per_page=200`, { headers: admin })).json();
    const user = users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (user || users.length < 200) return user ?? null;
  }
}
const setLang = (id, metadata) => fetch(`${URL_}/auth/v1/admin/users/${id}`, { method: 'PUT', headers: admin, body: JSON.stringify({ user_metadata: metadata }) });

let user = await findUser();
const created = !user;
if (created) {
  const response = await fetch(`${URL_}/auth/v1/admin/users`, { method: 'POST', headers: admin, body: JSON.stringify({ email, password: `T${crypto.randomUUID()}!`, email_confirm: true }) });
  user = await response.json();
  if (!user.id) throw new Error(`compte temporaire non créé (${response.status})`);
}
const previousLang = user.user_metadata?.lang;
console.log(created ? 'compte temporaire créé' : `compte existant (langue d'e-mail : ${previousLang ?? 'aucune'})`);
try {
  for (const [index, lang] of langs.entries()) {
    if (index > 0) await sleep(61_000);
    await setLang(user.id, { lang });
    const response = await fetch(`${URL_}/auth/v1/recover`, {
      method: 'POST', headers: admin,
      body: JSON.stringify({ email, redirect_to: 'myapp://auth/reset' }),
    });
    console.log(`${response.ok ? 'OK' : 'ÉCHEC'} : e-mail ${lang} (${response.status})${response.ok ? '' : ' ' + (await response.text()).slice(0, 200)}`);
  }
} finally {
  if (created) {
    // Laisse au serveur le temps de remettre l'e-mail au SMTP avant la suppression du compte
    await sleep(5_000);
    console.log('compte temporaire supprimé :', (await fetch(`${URL_}/auth/v1/admin/users/${user.id}`, { method: 'DELETE', headers: admin })).status);
  } else {
    await setLang(user.id, { lang: previousLang ?? null });
    console.log('langue d\'e-mail remise');
  }
}
