// Recompresse les images déjà stockées dans le bucket recipe-images (même traitement que
// generate-recipe-image : 800 px, JPEG qualité 75). Chaque image garde son chemin, donc son URL.
// Les originaux sont d'abord copiés dans backups/recipe-images/ (hors de git).
//
// Lancement (clé secrète dans l'environnement, jamais dans le code) :
//   SUPABASE_URL=https://<projet>.supabase.co SUPABASE_SECRET_KEY=sb_secret_... \
//     deno run --no-config -A scripts/recompress-recipe-images.ts [--dry-run]

import { compressRecipeImage } from '../supabase/functions/_shared/image.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SECRET_KEY = Deno.env.get('SUPABASE_SECRET_KEY');
if (!SUPABASE_URL || !SECRET_KEY) throw new Error('SUPABASE_URL et SUPABASE_SECRET_KEY sont nécessaires');

const BUCKET = 'recipe-images';
// Images déjà compressées (ou petites) laissées telles quelles
const SKIP_BELOW_BYTES = 200 * 1024;
const DRY_RUN = Deno.args.includes('--dry-run');
const headers = { apikey: SECRET_KEY };

async function list(prefix: string): Promise<Array<{ name: string; id: string | null }>> {
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${BUCKET}`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefix, limit: 1000 }),
  });
  if (!response.ok) throw new Error(`liste ${prefix} : HTTP ${response.status}`);
  return await response.json();
}

// Un dossier par utilisateur ; les dossiers ont un id null
const paths: string[] = [];
for (const folder of await list('')) {
  if (folder.id !== null) continue;
  for (const file of await list(folder.name)) {
    if (file.id !== null) paths.push(`${folder.name}/${file.name}`);
  }
}
console.log(`${paths.length} image(s) dans ${BUCKET}${DRY_RUN ? ' (essai, rien n’est modifié)' : ''}`);

let before = 0, after = 0, done = 0;
for (const path of paths) {
  const download = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, { headers });
  if (!download.ok) {
    console.error(`${path} : téléchargement impossible (HTTP ${download.status})`);
    continue;
  }
  const original = new Uint8Array(await download.arrayBuffer());
  before += original.length;
  if (original.length < SKIP_BELOW_BYTES) {
    after += original.length;
    console.log(`${path} : ${Math.round(original.length / 1024)} Ko, déjà léger, laissé tel quel`);
    continue;
  }

  const compressed = await compressRecipeImage(original);
  after += compressed.length;
  console.log(`${path} : ${Math.round(original.length / 1024)} Ko → ${Math.round(compressed.length / 1024)} Ko`);
  if (DRY_RUN) continue;

  const backup = `backups/${BUCKET}/${path}`;
  await Deno.mkdir(backup.slice(0, backup.lastIndexOf('/')), { recursive: true });
  await Deno.writeFile(backup, original);

  const upload = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': 'image/jpeg', 'x-upsert': 'true' },
    body: compressed.slice().buffer as ArrayBuffer,
  });
  if (!upload.ok) {
    console.error(`${path} : envoi impossible (HTTP ${upload.status}) ; original conservé dans ${backup}`);
    continue;
  }
  done++;
}
console.log(`Terminé : ${done} image(s) recompressée(s), ${Math.round(before / 1024)} Ko → ${Math.round(after / 1024)} Ko au total`);
