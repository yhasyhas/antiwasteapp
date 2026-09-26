// Relecture des fiches aliments.
//
// Lancement, depuis la racine du projet (CLI Supabase lié, SUPABASE_ACCESS_TOKEN défini) :
//   node scripts/food-facts/review.mjs                     # export/food-facts-review.md (fiches signalées en tête)
//   node scripts/food-facts/review.mjs --reviewed banana,kiwi   # marque ces fiches comme relues
//   node scripts/food-facts/review.mjs --regenerate banana      # régénère une fiche (après correction du prompt, par exemple)
//
// Le fichier d'export (dossier export/, hors de git) présente chaque fiche dans les trois langues, avec
// ses signalements en regard.

import { execSync } from 'node:child_process';
import fs from 'node:fs';

const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split(/\r?\n/).filter((line) => line.includes('='))
  .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
const SUPABASE_URL = env.EXPO_PUBLIC_SUPABASE_URL;
const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0];
// Clé secrète lue avec le CLI, gardée en mémoire, jamais affichée
const keys = JSON.parse(execSync(`npx supabase projects api-keys --project-ref ${projectRef} --reveal -o json`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
const SECRET = keys.find((key) => key.type === 'secret' && key.name === 'default')?.api_key;
if (!SECRET) throw new Error('Clé secrète introuvable (CLI Supabase lié ?)');
const headers = { apikey: SECRET, 'Content-Type': 'application/json' };

const api = async (path, init = {}) => {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } });
  if (!response.ok) throw new Error(`HTTP ${response.status} ${await response.text()}`);
  const text = await response.text();
  return text ? JSON.parse(text) : null;
};

const argument = (name) => {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : (process.argv[index + 1] ?? '').split(',').map((key) => key.trim()).filter(Boolean);
};

const reviewed = argument('--reviewed');
const regenerate = argument('--regenerate');

if (reviewed) {
  const list = reviewed.map((key) => `"${key}"`).join(',');
  const rows = await api(`food_facts?food_key=in.(${encodeURIComponent(list)})&status=eq.ready`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ reviewed: true, reviewed_at: new Date().toISOString() }),
  });
  console.log(`${rows.length} fiche(s) marquée(s) comme relue(s) : ${rows.map((row) => row.food_key).join(', ')}`);
} else if (regenerate) {
  for (const key of regenerate) {
    // Remise « en cours », réservation expirée : la fonction régénère la fiche (signalements conservés)
    await api(`food_facts?food_key=eq.${encodeURIComponent(key)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'generating', claimed_at: '2000-01-01T00:00:00Z' }),
    });
    const response = await fetch(`${SUPABASE_URL}/functions/v1/food-fact`, {
      method: 'POST',
      headers: { ...headers, 'x-simulate-key': SECRET },
      body: JSON.stringify({ food_key: key, name: key.replace(/_/g, ' ') }),
    });
    console.log(`${key} : ${response.ok ? 'régénérée' : `échec HTTP ${response.status}`}`);
  }
} else {
  const facts = await api('food_facts?select=food_key,content,reviewed,model,generated_at&status=eq.ready&order=food_key');
  const reports = await api('food_fact_reports?select=food_key,language,message,created_at&order=created_at.desc');
  const reportsOf = (key) => reports.filter((report) => report.food_key === key);
  // Signalées d'abord, puis non relues, puis relues
  facts.sort((a, b) => (reportsOf(b.food_key).length > 0) - (reportsOf(a.food_key).length > 0) || a.reviewed - b.reviewed);

  const lines = [
    '# Relecture des fiches aliments',
    '',
    `${facts.length} fiches, ${facts.filter((fact) => fact.reviewed).length} relues, ${new Set(reports.map((report) => report.food_key)).size} signalées. Export du ${new Date().toLocaleString('fr-FR')}.`,
    '',
    'Marquer comme relues : `node scripts/food-facts/review.mjs --reviewed cle1,cle2` ; régénérer : `--regenerate cle`.',
    '',
  ];
  for (const fact of facts) {
    const factReports = reportsOf(fact.food_key);
    lines.push(`## ${fact.food_key}${fact.reviewed ? ' — relue' : ''}${factReports.length > 0 ? ` — ${factReports.length} signalement(s)` : ''}`, '');
    for (const report of factReports) lines.push(`> **Signalement (${report.language}, ${report.created_at.slice(0, 10)})** : ${report.message || '(sans message)'}`, '');
    for (const language of ['fr', 'en', 'es']) {
      const section = fact.content[language];
      lines.push(
        `### ${language.toUpperCase()} — ${section.name}`,
        '',
        section.description,
        '',
        `- **Origine** : ${section.origin}`,
        `- **Saison** : ${section.season}`,
        `- **Atouts** : ${section.nutrition.join(' ; ')}`,
        `- **Anti-gaspi** : ${section.tips.join(' ; ')}`,
        '',
      );
    }
    lines.push(`*Modèle : ${fact.model ?? '?'}, ${String(fact.generated_at ?? '').slice(0, 10)}*`, '');
  }
  fs.mkdirSync('export', { recursive: true });
  fs.writeFileSync('export/food-facts-review.md', lines.join('\n'));
  console.log(`export/food-facts-review.md écrit : ${facts.length} fiches (${reports.length} signalements)`);
}
