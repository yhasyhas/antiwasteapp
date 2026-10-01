// Appel ponctuel de la copie d'évaluation (generate-recipes-eval) : actions sans génération (quota, modèles,
// titres récents). La clé secrète est lue avec le CLI Supabase et reste en mémoire (jamais affichée ni écrite).
//   node scripts/recipe-eval/call.mjs '{"action":"quota"}'

import { execSync } from 'node:child_process';
import fs from 'node:fs';

const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split(/\r?\n/).filter((l) => l.includes('=') && !l.startsWith('#'))
  .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));

export function secretKey() {
  const keys = JSON.parse(execSync('npx supabase projects api-keys --project-ref iqzjonmjlscuckdmiehk --reveal -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
  const secret = keys.find((k) => k.type === 'secret' && k.name === 'default')?.api_key;
  if (!secret) throw new Error('clé secrète introuvable');
  return secret;
}

export function evalClient(secret = secretKey()) {
  // Coupure réseau passagère : jusqu'à 3 nouveaux essais, 30 s d'intervalle
  return async (body) => {
    for (let attempt = 0; ; attempt++) {
      try {
        const response = await fetch(`${env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/generate-recipes-eval`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, 'x-eval-key': secret },
          body: JSON.stringify(body),
        });
        return { status: response.status, data: await response.json() };
      } catch (error) {
        if (attempt >= 3) return { status: 0, data: { error: 'network', details: String(error) } };
        await new Promise((resolve) => setTimeout(resolve, 30_000));
      }
    }
  };
}

if (process.argv[1]?.endsWith('call.mjs')) {
  const call = evalClient();
  for (const arg of process.argv.slice(2)) console.log(JSON.stringify(await call(JSON.parse(arg))));
}
