// Modèles des e-mails d'authentification de Supabase (réinitialisation du mot de passe, confirmation d'inscription),
// en français, anglais et espagnol, aux couleurs de l'app (constants/theme.ts).
// Langue : métadonnée `lang` du compte (`.Data.lang`, copiée depuis les préférences : migration 20261006110000) ;
// sans elle, français. Supabase lit ces modèles comme des modèles Go : le sujet et le contenu choisissent la langue
// avec `{{ if eq $lang "en" }}…{{ else if eq $lang "es" }}…{{ else }}…{{ end }}`.
// Envoi à Supabase et aperçus : scripts/email-templates/push.mjs.

// Nom affiché dans les e-mails et comme expéditeur : le changer ici, puis relancer push.mjs
export const APP_NAME = 'Antigaspi';

export const LANGUAGES = ['fr', 'en', 'es'];

const COLORS = {
  background: '#F3F7F1',
  surface: '#FFFFFF',
  text: '#15241B',
  textSecondary: '#52645A',
  border: '#D7E3D5',
  primary: '#2E6A4A',
  onPrimary: '#FFFFFF',
  accent: '#B9D45A',
};

const TEXTS = {
  recovery: {
    fr: {
      subject: 'Réinitialise ton mot de passe {app}',
      title: 'Nouveau mot de passe',
      intro: 'Tu as demandé à changer le mot de passe de ton compte {app}. Choisis-en un nouveau, sur ton téléphone ou sur un ordinateur :',
      button: 'Choisir un nouveau mot de passe',
      validity: 'Ce lien est valable 1 heure et ne sert qu’une fois.',
      ignore: 'Si tu n’as rien demandé, ignore cet e-mail : ton mot de passe ne change pas.',
    },
    en: {
      subject: 'Reset your {app} password',
      title: 'New password',
      intro: 'You asked to change the password of your {app} account. Choose a new one, on your phone or on a computer:',
      button: 'Choose a new password',
      validity: 'This link is valid for 1 hour and works only once.',
      ignore: 'If you didn’t ask for this, ignore this email: your password stays the same.',
    },
    es: {
      subject: 'Restablece tu contraseña de {app}',
      title: 'Nueva contraseña',
      intro: 'Pediste cambiar la contraseña de tu cuenta de {app}. Elige una nueva, en tu teléfono o en un ordenador:',
      button: 'Elegir una nueva contraseña',
      validity: 'Este enlace es válido durante 1 hora y solo funciona una vez.',
      ignore: 'Si no lo pediste, ignora este correo: tu contraseña no cambia.',
    },
  },
  confirmation: {
    fr: {
      subject: 'Confirme ton adresse pour {app}',
      title: 'Bienvenue sur {app}',
      intro: 'Confirme ton adresse e-mail pour activer ton compte :',
      button: 'Confirmer mon adresse',
      validity: null,
      ignore: 'Si tu n’as pas créé de compte, ignore cet e-mail.',
    },
    en: {
      subject: 'Confirm your email for {app}',
      title: 'Welcome to {app}',
      intro: 'Confirm your email address to activate your account:',
      button: 'Confirm my email',
      validity: null,
      ignore: 'If you didn’t create an account, ignore this email.',
    },
    es: {
      subject: 'Confirma tu correo para {app}',
      title: 'Te damos la bienvenida a {app}',
      intro: 'Confirma tu dirección de correo para activar tu cuenta:',
      button: 'Confirmar mi correo',
      validity: null,
      ignore: 'Si no creaste una cuenta, ignora este correo.',
    },
  },
};

const COMMON = {
  fr: { fallback: 'Le bouton ne marche pas ? Copie ce lien dans ton navigateur :', footer: 'E-mail automatique envoyé par {app}, merci de ne pas y répondre.' },
  en: { fallback: 'Button not working? Copy this link into your browser:', footer: 'Automatic email sent by {app}, please do not reply.' },
  es: { fallback: '¿El botón no funciona? Copia este enlace en tu navegador:', footer: 'Correo automático enviado por {app}, no respondas a este mensaje.' },
};

// Lien fourni par Supabase (il contient le jeton)
const LINK = '{{ .ConfirmationURL }}';

// Langue du compte, français par défaut ; printf : une valeur qui ne serait pas un texte ne bloque pas l'envoi
const LANG_PRELUDE = '{{ $lang := "fr" }}{{ with .Data }}{{ with .lang }}{{ $lang = printf "%v" . }}{{ end }}{{ end }}';

const escapeHtml = (value) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const withApp = (value, appName) => value.replaceAll('{app}', appName);

// Une branche par langue, le français en dernier (valeur par défaut)
function byLanguage(render) {
  return `${LANG_PRELUDE}{{ if eq $lang "en" }}${render('en')}{{ else if eq $lang "es" }}${render('es')}{{ else }}${render('fr')}{{ end }}`;
}

function htmlFor(kind, lang, appName) {
  const t = TEXTS[kind][lang];
  const common = COMMON[lang];
  const text = (value) => escapeHtml(withApp(value, appName));
  const c = COLORS;
  const font = 'font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;';
  return `<!DOCTYPE html>
<html lang="${lang}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${text(t.subject)}</title></head>
<body style="margin:0;padding:0;background:${c.background};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${c.background};">
<tr><td align="center" style="padding:24px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:${c.surface};border:1px solid ${c.border};border-radius:16px;">
<tr><td style="background:${c.primary};border-radius:16px 16px 0 0;padding:20px 28px;${font}font-size:22px;font-weight:700;color:${c.onPrimary};">${text(appName)}</td></tr>
<tr><td style="height:4px;background:${c.accent};font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="padding:28px;${font}color:${c.text};">
<h1 style="margin:0 0 16px;font-size:22px;line-height:28px;color:${c.text};">${text(t.title)}</h1>
<p style="margin:0 0 24px;font-size:16px;line-height:24px;">${text(t.intro)}</p>
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:12px;background:${c.primary};">
<a href="${LINK}" style="display:inline-block;padding:14px 24px;${font}font-size:16px;font-weight:700;color:${c.onPrimary};text-decoration:none;border-radius:12px;">${text(t.button)}</a>
</td></tr></table>
${t.validity ? `<p style="margin:24px 0 0;font-size:14px;line-height:20px;color:${c.textSecondary};">${text(t.validity)}</p>\n` : ''}<p style="margin:${t.validity ? '8px' : '24px'} 0 0;font-size:14px;line-height:20px;color:${c.textSecondary};">${text(t.ignore)}</p>
<p style="margin:24px 0 0;font-size:13px;line-height:18px;color:${c.textSecondary};">${text(common.fallback)}<br><a href="${LINK}" style="color:${c.primary};word-break:break-all;">${LINK}</a></p>
</td></tr>
</table>
<p style="margin:16px 0 0;${font}font-size:12px;line-height:16px;color:${c.textSecondary};">${text(common.footer)}</p>
</td></tr>
</table>
</body>
</html>`;
}

// Sujet et contenu de chaque modèle, prêts pour l'API de gestion de Supabase
export function buildTemplates(appName = APP_NAME) {
  const build = (kind) => ({
    subject: byLanguage((lang) => withApp(TEXTS[kind][lang].subject, appName)),
    content: byLanguage((lang) => htmlFor(kind, lang, appName)),
  });
  return { recovery: build('recovery'), confirmation: build('confirmation') };
}

// Aperçu d'une langue, avec un lien d'exemple à la place de celui de Supabase
export function previewHtml(kind, lang, appName = APP_NAME) {
  return htmlFor(kind, lang, appName).replaceAll(LINK, 'https://example.com/lien-de-supabase');
}
