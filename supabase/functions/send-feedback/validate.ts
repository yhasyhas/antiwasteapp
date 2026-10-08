// Contrôle des avis et des signalements reçus par send-feedback (mêmes limites que la base)

export interface Feedback {
  kind: 'problem' | 'idea' | 'other';
  message: string;
  app_version: string | null;
  device: string | null;
  os: string | null;
  language: string | null;
}

export interface Report {
  recipe_id: string;
  reason: 'dangerous' | 'incorrect' | 'bad' | 'translation';
  comment: string | null;
  language: string | null;
}

const KINDS = ['problem', 'idea', 'other'];
const APP_VARIANTS = ['development', 'preview', 'production'];
const REASONS = ['dangerous', 'incorrect', 'bad', 'translation'];

// Texte court facultatif : espaces réduits, coupé à max ; vide : null
function short(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const text = value.replace(/\s+/g, ' ').trim().slice(0, max);
  return text === '' ? null : text;
}

export function cleanFeedback(body: any): Feedback | null {
  const message = typeof body?.message === 'string' ? body.message.trim().slice(0, 2000) : '';
  if (!KINDS.includes(body?.kind) || message === '') return null;
  return {
    kind: body.kind,
    message,
    app_version: short(body.app_version, 40),
    device: short(body.device, 80),
    os: short(body.os, 40),
    language: short(body.language, 5),
  };
}

// Variante de l'app qui envoie (app.config.js : development, preview = build de test des amis, production) :
// environnement de l'événement Sentry. Sans variante (build de test 1, envoyé avant ce champ), elle se déduit de
// la version (lib/buildLabel.ts : « 1.0, test 1 », « 1.0, dev ») ; sinon production.
export function appEnvironment(body: any): 'development' | 'preview' | 'production' {
  if (APP_VARIANTS.includes(body?.app_variant)) return body.app_variant;
  const version = typeof body?.app_version === 'string' ? body.app_version : '';
  if (/, test \d+$/.test(version)) return 'preview';
  if (/, dev$/.test(version)) return 'development';
  return 'production';
}

export function cleanReport(body: any): Report | null {
  if (typeof body?.recipe_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.recipe_id) || !REASONS.includes(body?.reason)) return null;
  return {
    recipe_id: body.recipe_id,
    reason: body.reason,
    comment: typeof body.comment === 'string' && body.comment.trim() !== '' ? body.comment.trim().slice(0, 500) : null,
    language: short(body.language, 5),
  };
}
