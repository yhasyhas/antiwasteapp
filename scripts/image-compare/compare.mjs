// Comparaison des consignes d'image (IMAGE_PROMPT_VERSION v1 et v2) sur les mêmes recettes, par la vraie
// fonction generate-recipe-image (version imposée par « prompt_version », accepté avec la clé secrète seulement).
// Compte de test créé par l'API admin (aucun e-mail envoyé) ; ses images et le compte sont supprimés à la fin ;
// aucun secret affiché. Coût : 2 images par recette (≈ 0,002 $ l'image au-delà de l'allocation gratuite).
// Lancement depuis la racine :
//   node scripts/image-compare/compare.mjs <dossier de sortie> [images en parallèle, 3 par défaut] [versions, « v1,v2 » par défaut] [jeu : varied | fish]
// Chaque image est redemandée jusqu'à 3 fois si Cloudflare échoue (pannes passagères du 05/10/2026).
// Résultat : <dossier>/comparaison.json (recette, consigne, image en base64), pour une page côte à côte.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const out = process.argv[2];
if (!out) throw new Error('dossier de sortie manquant');
fs.mkdirSync(out, { recursive: true });
const { secretKey } = await import(pathToFileURL(process.cwd() + '/scripts/recipe-eval/call.mjs').href);
const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split(/\r?\n/).filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const URL_ = env.EXPO_PUBLIC_SUPABASE_URL, PUB = env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SECRET = secretKey();
const admin = { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' };

// Six recettes variées, avec la description d'image écrite par generate-recipes (évaluations de la phase 9) ;
// la dorade, absente des évaluations, est écrite dans le même style
const VARIED = [
  { title: 'Mafé de poulet', image_prompt: 'Professional food photography, hearty chicken mafé in a rustic clay pot, creamy peanut sauce, bright red tomatoes, green carrots, warm lighting' },
  { title: 'Dorade entière grillée, sauce aux oignons', image_prompt: 'Professional food photography, whole grilled sea bream with crispy charred skin, lemon slices and fresh herbs, onion and tomato sauce on the side, served on an oval platter, natural light' },
  { title: 'Ragoût de porc aux poireaux et haricots verts', image_prompt: 'Hearty French ragout in a rustic casserole, cubes of pork tenderloin in a creamy mustard sauce with translucent leeks, green beans, and shallots, steam rising, wooden table, natural light' },
  { title: 'Penne gratinées à la mozzarella et sauce tomate basilic', image_prompt: 'Professional food photography, baked penne pasta with bubbling mozzarella, rich red tomato basil sauce, golden crust, rustic white plate, natural light' },
  { title: 'Salade méchouia de carottes et pois chiches', image_prompt: 'Bright Mediterranean salad bowl with orange carrot ribbons, chickpeas, fresh herbs, and a drizzle of olive oil, natural light' },
  { title: 'Omelette du soir aux restes de poulet, courgettes et fromage', image_prompt: 'Golden fluffy omelette folded, filled with shredded chicken, green zucchini ribbons, melted cheese, soft interior, plated on a white ceramic dish, soft morning light' },
];
// Poissons et volaille entière (règle de la v1.1) : les descriptions imitent celles de generate-recipes
const FISH_DISHES = [
  VARIED[1],
  { title: 'Thiéboudienne', image_prompt: 'Professional food photography, Senegalese thieboudienne, whole stuffed grouper on a bed of red tomato rice, cassava, carrots and cabbage, large communal platter, warm natural light' },
  { title: 'Tilapia braisé, sauce tomate pimentée', image_prompt: 'Professional food photography, whole braised tilapia in a spicy tomato and pepper sauce, fried plantains on the side, rustic plate, natural light' },
  { title: 'Curry de poisson au lait de coco', image_prompt: 'Professional food photography, creamy coconut fish curry with chunks of white fish, tomatoes and fresh coriander, served in a clay pot with steamed rice, warm light' },
  { title: 'Maquereaux grillés, salade de pommes de terre', image_prompt: 'Professional food photography, two whole grilled mackerels with charred skin, warm potato salad with herbs, lemon wedges, wooden table, natural light' },
  { title: 'Poulet rôti aux pommes de terre', image_prompt: 'Professional food photography, golden whole roast chicken with crispy skin, roasted potatoes and thyme in a roasting dish, natural light' },
];
const DISHES = process.argv[5] === 'fish' ? FISH_DISHES : VARIED;
const VERSIONS = (process.argv[4] || 'v1,v2').split(',');
const CONCURRENCY = Math.max(1, Number(process.argv[3]) || 3);
const ATTEMPTS = 3;

const email = `img-compare-${Date.now()}@example.com`;
let userId = null;
const results = [];
try {
  userId = (await (await fetch(`${URL_}/auth/v1/admin/users`, { method: 'POST', headers: admin, body: JSON.stringify({ email, password: `T${crypto.randomUUID()}!`, email_confirm: true }) })).json()).id;
  const link = await (await fetch(`${URL_}/auth/v1/admin/generate_link`, { method: 'POST', headers: admin, body: JSON.stringify({ type: 'magiclink', email }) })).json();
  const session = await (await fetch(`${URL_}/auth/v1/verify`, { method: 'POST', headers: { apikey: PUB, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'magiclink', token_hash: link.hashed_token ?? link.properties?.hashed_token }) })).json();
  const asUser = { apikey: PUB, Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' };
  await fetch(`${URL_}/rest/v1/profiles`, { method: 'POST', headers: asUser, body: JSON.stringify({ id: userId, email }) });

  // Une recette par plat et par version : la fonction ne génère qu'une image par recette
  const rows = DISHES.flatMap((dish) => VERSIONS.map((version) => ({ user_id: userId, title: dish.title, image_prompt: dish.image_prompt, version })));
  const inserted = await (await fetch(`${URL_}/rest/v1/recipes?select=id`, {
    method: 'POST', headers: { ...asUser, Prefer: 'return=representation' },
    body: JSON.stringify(rows.map(({ version, ...row }) => row)),
  })).json();
  if (!Array.isArray(inserted) || inserted.length !== rows.length) throw new Error(`recettes non créées : ${JSON.stringify(inserted).slice(0, 200)}`);

  // Trois images à la fois par défaut, comme une génération dans l'app
  const jobs = rows.map((row, i) => ({ ...row, id: inserted[i].id }));
  for (let i = 0; i < jobs.length; i += CONCURRENCY) {
    await Promise.all(jobs.slice(i, i + CONCURRENCY).map(async (job) => {
      const started = Date.now();
      let response, data;
      for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
        response = await fetch(`${URL_}/functions/v1/generate-recipe-image`, {
          method: 'POST', headers: { ...asUser, 'x-simulate-key': SECRET },
          body: JSON.stringify({ recipe_id: job.id, language: 'fr', prompt_version: job.version }),
        });
        data = await response.json();
        if (data.image_url || attempt === ATTEMPTS) break;
        console.log(`nouvel essai ${job.version} « ${job.title} » (${response.status} ${data.error ?? ''})`);
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
      const ms = Date.now() - started;
      if (!data.image_url) {
        console.log(`ÉCHEC ${job.version} « ${job.title} » : ${response.status} ${data.error ?? ''}`);
        results.push({ title: job.title, version: job.version, ms, error: data.error ?? String(response.status) });
        return;
      }
      const bytes = Buffer.from(await (await fetch(data.image_url)).arrayBuffer());
      console.log(`OK ${job.version} « ${job.title} » en ${(ms / 1000).toFixed(1)} s`);
      results.push({ title: job.title, version: job.version, ms, image: `data:image/jpeg;base64,${bytes.toString('base64')}` });
    }));
  }
  fs.writeFileSync(path.join(out, 'comparaison.json'), JSON.stringify({ versions: VERSIONS, dishes: DISHES, results }, null, 1));
  console.log(`résultat : ${path.join(out, 'comparaison.json')}`);
} catch (error) {
  console.log('ÉCHEC :', String(error?.message ?? error).slice(0, 300));
} finally {
  if (userId) {
    // Images du compte de test (dossier <user_id>/ du bucket), puis le compte (ses recettes avec lui)
    const listed = await (await fetch(`${URL_}/storage/v1/object/list/recipe-images`, { method: 'POST', headers: admin, body: JSON.stringify({ prefix: `${userId}/`, limit: 100 }) })).json();
    const prefixes = Array.isArray(listed) ? listed.map((item) => `${userId}/${item.name}`) : [];
    if (prefixes.length > 0) {
      const removed = await fetch(`${URL_}/storage/v1/object/recipe-images`, { method: 'DELETE', headers: admin, body: JSON.stringify({ prefixes }) });
      console.log(`images de test supprimées : ${prefixes.length} (${removed.status})`);
    }
    console.log('compte de test supprimé :', (await fetch(`${URL_}/auth/v1/admin/users/${userId}`, { method: 'DELETE', headers: admin })).status);
  }
}
