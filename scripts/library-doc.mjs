// Version lisible de la bibliothèque de plats (supabase/functions/generate-recipes/library/*.json), pour la
// relecture par des personnes qui cuisinent ces plats : docs/bibliotheque-plats.md. À relancer après chaque
// modification des fichiers JSON.
//   node scripts/library-doc.mjs

import fs from 'node:fs';
import { REGIONS } from '../supabase/functions/generate-recipes/library.ts';

const MOMENTS = { breakfast: 'matin', lunch: 'midi', dinner: 'soir', snack: 'encas' };
const DIET = { vegan: 'vegan', vegetarian: 'végétarien', '': '' };
const CUISINES = { african: 'Africaine', maghreb: 'Maghreb', asian: 'Asiatique', latin: 'Amérique latine', mediterranean: 'Méditerranéenne', french: 'Française' };
const cell = (text) => String(text).replace(/\|/g, '/');
const total = REGIONS.reduce((n, r) => n + r.dishes.length, 0);

const lines = [
  '# Bibliothèque de plats de référence',
  '',
  `${total} plats dans ${REGIONS.length} régions. Fichier généré par \`node scripts/library-doc.mjs\` à partir de \`supabase/functions/generate-recipes/library/\` : on corrige les fichiers JSON, puis on relance le script.`,
  '',
  '**À quoi elle sert** : quand une cuisine précise est choisie, le prompt reçoit 5 plats tirés au hasard dans ses régions (du moment de la journée demandé), comme source d\'inspiration. Le modèle s\'inspire de l\'esprit de la cuisine et crée des recettes adaptées au garde-manger, sans recopier ces plats ni s\'y limiter. Avec « Peu importe », aucun plat n\'est envoyé.',
  '',
  '**Pour les relecteurs** : pour chaque plat, vérifier le nom, les pays, les ingrédients essentiels (sans eux ce n\'est plus ce plat), les techniques, les moments où on le mange vraiment, et le régime de la version courante. Signaler aussi les plats importants qui manquent.',
  '',
  '## Sommaire',
  '',
  '| Région | Cuisine de l\'app | Plats | Matin | Encas |',
  '|---|---|---|---|---|',
  ...REGIONS.map((r) => `| [${r.name}](#${r.id}) | ${CUISINES[r.cuisine]} | ${r.dishes.length} | ${r.dishes.filter((d) => d.moments.includes('breakfast')).length} | ${r.dishes.filter((d) => d.moments.includes('snack')).length} |`),
  '',
];
for (const region of REGIONS) {
  lines.push(`<a id="${region.id}"></a>`, '', `## ${region.name} (${region.dishes.length} plats)`, '',
    '| Plat | Pays | Ingrédients essentiels | Techniques | Moments | Régime |', '|---|---|---|---|---|---|',
    ...region.dishes.map((d) => `| ${cell(d.name)} | ${cell(d.country)} | ${cell(d.ingredients.join(', '))} | ${cell(d.techniques.join(', '))} | ${d.moments.map((m) => MOMENTS[m]).join(', ')} | ${DIET[d.diet] ?? d.diet} |`),
    '');
}
fs.writeFileSync('docs/bibliotheque-plats.md', lines.join('\n'));
console.log(`docs/bibliotheque-plats.md : ${total} plats`);
