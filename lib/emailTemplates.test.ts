// Modèles des e-mails d'authentification (scripts/email-templates/templates.mjs).
// Lancement : deno test --no-config --allow-env supabase/functions/ lib/
import { assert, assertEquals, assertMatch } from 'jsr:@std/assert@1';
import { APP_NAME, buildTemplates } from '../scripts/email-templates/templates.mjs';

const PRELUDE = '{{ $lang := "fr" }}{{ with .Data }}{{ with .lang }}{{ $lang = printf "%v" . }}{{ end }}{{ end }}';
const LINK = '{{ .ConfirmationURL }}';

// Les trois branches (anglais, espagnol, français par défaut) d'un modèle Go à choix de langue
function branches(template: string): Record<'en' | 'es' | 'fr', string> {
  assert(template.startsWith(PRELUDE), 'langue lue dans les métadonnées du compte, français par défaut');
  const match = template.slice(PRELUDE.length).match(/^\{\{ if eq \$lang "en" \}\}(.*)\{\{ else if eq \$lang "es" \}\}(.*)\{\{ else \}\}(.*)\{\{ end \}\}$/s);
  assert(match, 'structure si / sinon si / sinon / fin');
  return { en: match[1], es: match[2], fr: match[3] };
}

Deno.test('e-mails : une branche par langue, avec le lien de Supabase et aucune autre instruction', () => {
  const templates = buildTemplates();
  const expected = {
    recovery: { fr: 'Choisir un nouveau mot de passe', en: 'Choose a new password', es: 'Elegir una nueva contraseña' },
    confirmation: { fr: 'Confirmer mon adresse', en: 'Confirm my email', es: 'Confirmar mi correo' },
  } as const;
  for (const kind of ['recovery', 'confirmation'] as const) {
    const subjects = branches(templates[kind].subject);
    const contents = branches(templates[kind].content);
    for (const lang of ['fr', 'en', 'es'] as const) {
      assert(!subjects[lang].includes('{{') && subjects[lang].includes(APP_NAME), `${kind} ${lang} : sujet`);
      const html = contents[lang];
      assertMatch(html, new RegExp(`<html lang="${lang}">`));
      assert(html.includes(expected[kind][lang]), `${kind} ${lang} : bouton`);
      // Bouton, puis lien à copier (adresse et texte)
      assertEquals(html.split(LINK).length - 1, 3, `${kind} ${lang} : lien`);
      assertEquals(html.split('{{').length - 1, 3, `${kind} ${lang} : seul le lien est une instruction du modèle`);
    }
  }
});

Deno.test('e-mails : le nom de l’app se change en un seul endroit', () => {
  const templates = buildTemplates('Frigo & Co');
  const all = JSON.stringify(templates);
  assert(!all.includes(APP_NAME), 'ancien nom absent');
  assert(templates.recovery.content.includes('Frigo &amp; Co'), 'nom échappé dans le contenu');
  assert(branches(templates.recovery.subject).fr.includes('Frigo & Co'), 'nom dans le sujet');
});
