// Déploie le site Cloudflare Pages (page d'invitation, captcha, « Nouveau mot de passe ») depuis web/invite.
// Les pages qui appellent Supabase reçoivent ici son adresse et sa clé publique (EXPO_PUBLIC_SUPABASE_URL et
// EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, lues dans .env : valeurs publiques, déjà dans l'app), dans une copie
// temporaire : le dépôt garde les marqueurs __SUPABASE_URL__ et __SUPABASE_PUBLISHABLE_KEY__.
// Wrangler connecté par OAuth (docs/ENVIRONMENT.md, section 6). Lancement depuis la racine :
//   node scripts/deploy-pages.mjs            déploie
//   node scripts/deploy-pages.mjs --dry-run  prépare la copie et affiche son dossier, sans déployer
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const SOURCE = 'web/invite';
const PROJECT = 'antigaspi-invite';
const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split(/\r?\n/).filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
const values = {
  __SUPABASE_URL__: env.EXPO_PUBLIC_SUPABASE_URL,
  __SUPABASE_PUBLISHABLE_KEY__: env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
};
for (const [marker, value] of Object.entries(values)) {
  if (!value) throw new Error(`${marker} : valeur absente de .env`);
  // Une clé secrète ne doit jamais partir dans une page publique
  if (/^sb_secret_/.test(value)) throw new Error(`${marker} : clé secrète refusée`);
}

const out = fs.mkdtempSync(path.join(os.tmpdir(), 'pages-'));
for (const name of fs.readdirSync(SOURCE)) {
  let content = fs.readFileSync(path.join(SOURCE, name), 'utf8');
  for (const [marker, value] of Object.entries(values)) content = content.replaceAll(marker, value);
  if (/__SUPABASE_[A-Z_]+__/.test(content)) throw new Error(`${name} : marqueur non remplacé`);
  fs.writeFileSync(path.join(out, name), content);
}
console.log('copie prête :', out);
if (process.argv.includes('--dry-run')) process.exit(0);

execFileSync('npx', ['wrangler', 'pages', 'deploy', out, '--project-name', PROJECT, '--branch', 'main', '--commit-dirty=true'], { stdio: 'inherit', shell: true });
fs.rmSync(out, { recursive: true, force: true });
