// Envoie les modèles d'e-mail (templates.mjs) et le nom d'expéditeur à Supabase, par l'API de gestion
// (SUPABASE_ACCESS_TOKEN, docs/ENVIRONMENT.md). Aucun secret affiché ; les réglages SMTP ne sont pas touchés.
// Lancement depuis la racine :
//   node scripts/email-templates/push.mjs               envoie les modèles
//   node scripts/email-templates/push.mjs --preview DIR écrit un aperçu HTML par modèle et par langue, sans rien envoyer
import fs from 'node:fs';
import path from 'node:path';
import { APP_NAME, LANGUAGES, buildTemplates, previewHtml } from './templates.mjs';

const PROJECT = 'iqzjonmjlscuckdmiehk';
const templates = buildTemplates();

const previewIndex = process.argv.indexOf('--preview');
if (previewIndex !== -1) {
  const dir = process.argv[previewIndex + 1];
  if (!dir) throw new Error('dossier des aperçus manquant');
  fs.mkdirSync(dir, { recursive: true });
  for (const kind of Object.keys(templates)) {
    for (const lang of LANGUAGES) fs.writeFileSync(path.join(dir, `${kind}-${lang}.html`), previewHtml(kind, lang));
  }
  console.log('aperçus :', dir);
  process.exit(0);
}

const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) throw new Error('SUPABASE_ACCESS_TOKEN absent');
const body = {
  smtp_sender_name: APP_NAME,
  mailer_subjects_recovery: templates.recovery.subject,
  mailer_templates_recovery_content: templates.recovery.content,
  mailer_subjects_confirmation: templates.confirmation.subject,
  mailer_templates_confirmation_content: templates.confirmation.content,
};
const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT}/config/auth`, {
  method: 'PATCH',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
if (!response.ok) {
  console.log('ÉCHEC', response.status, (await response.text()).slice(0, 300));
  process.exit(1);
}
// Relecture : ce qui est en place correspond à ce qui a été envoyé
const config = await response.json();
for (const key of Object.keys(body)) console.log(config[key] === body[key] ? 'OK' : 'DIFFÉRENT', ':', key);
