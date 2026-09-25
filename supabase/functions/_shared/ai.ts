// Appels aux modèles d'IA : une interface unique pour Gemini et Groq, avec sortie JSON structurée
// (schéma), fournisseur principal et secours.
//
// - Chaque fournisseur renvoie le texte JSON brut ; la fonction appelante le lit et le valide (parse).
// - runWithFallback essaie les fournisseurs dans l'ordre : n'importe quel échec du premier (HTTP, délai,
//   JSON illisible, réponse non conforme) fait lancer le suivant. Avec hedgeDelayMs, le suivant est aussi
//   lancé si le premier n'a pas répondu à temps ; la première réponse valide l'emporte, l'autre est annulée.
// - Les clés d'API ne quittent jamais le serveur : les détails d'erreur ne contiennent que les réponses
//   des fournisseurs.

export interface AiRequest {
  // Consignes générales (rôle, règles) ; envoyées en message système quand le fournisseur le permet
  system?: string;
  prompt: string;
  image?: { base64: string; mimeType: string };
  schema: Record<string, unknown>;
  schemaName: string;
  temperature: number;
  maxOutputTokens: number;
}

export type ProviderResult =
  | { ok: true; text: string; usage?: unknown }
  | { ok: false; status?: number; details: string };

export interface AiProvider {
  name: string;
  model: string;
  configured: boolean;
  call: (request: AiRequest, signal: AbortSignal) => Promise<ProviderResult>;
}

function describeError(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

// Délai propre au fournisseur, et annulation quand un autre fournisseur a déjà répondu
function withTimeout(signal: AbortSignal, timeoutMs: number): AbortSignal {
  return AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]);
}

// ---------- Gemini (Interactions API) ----------

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';

export function geminiProvider(options: {
  apiKey: string;
  model: string;
  timeoutMs: number;
  thinkingLevel: 'minimal' | 'low' | 'medium' | 'high';
}): AiProvider {
  return {
    name: 'gemini',
    model: options.model,
    configured: options.apiKey !== '' && options.model !== '',
    call: async (request, signal) => {
      try {
        const input: unknown[] = [{ type: 'text', text: request.system ? `${request.system}\n\n${request.prompt}` : request.prompt }];
        if (request.image) input.push({ type: 'image', data: request.image.base64, mime_type: request.image.mimeType });

        const response = await fetch(GEMINI_API_URL, {
          method: 'POST',
          headers: { 'x-goog-api-key': options.apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: options.model,
            // Ne pas conserver les données des utilisateurs chez Google
            store: false,
            input,
            response_format: { type: 'text', mime_type: 'application/json', schema: request.schema },
            generation_config: {
              temperature: request.temperature,
              thinking_level: options.thinkingLevel,
              max_output_tokens: request.maxOutputTokens,
            },
          }),
          signal: withTimeout(signal, options.timeoutMs),
        });

        if (!response.ok) {
          const errorText = await response.text();
          return { ok: false, status: response.status, details: `Gemini ${response.status}: ${errorText.slice(0, 300)}` };
        }

        // Le texte est dans steps[type=model_output].content[type=text]
        const interaction = await response.json();
        if (interaction.status !== 'completed') {
          return { ok: false, details: `Gemini status ${interaction.status}` };
        }
        const text = (interaction.steps || [])
          .filter((step: any) => step.type === 'model_output')
          .flatMap((step: any) => step.content || [])
          .filter((item: any) => item.type === 'text' && typeof item.text === 'string')
          .map((item: any) => item.text)
          .join('');
        return { ok: true, text, usage: interaction.usage };
      } catch (error) {
        // Délai dépassé, annulation ou erreur réseau
        return { ok: false, details: `Gemini: ${describeError(error)}` };
      }
    },
  };
}

// ---------- Groq (API compatible OpenAI) ----------

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

async function requestGroq(
  options: { apiKey: string; model: string; timeoutMs: number; reasoningEffort: string },
  request: AiRequest,
  signal: AbortSignal,
): Promise<ProviderResult> {
  try {
    const userContent = request.image
      ? [
        { type: 'text', text: request.prompt },
        { type: 'image_url', image_url: { url: `data:${request.image.mimeType};base64,${request.image.base64}` } },
      ]
      : request.prompt;

    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${options.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: options.model,
        messages: [
          ...(request.system ? [{ role: 'system', content: request.system }] : []),
          { role: 'user', content: userContent },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: request.schemaName, strict: true, schema: request.schema },
        },
        temperature: request.temperature,
        reasoning_effort: options.reasoningEffort,
        max_completion_tokens: request.maxOutputTokens,
      }),
      signal: withTimeout(signal, options.timeoutMs),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { ok: false, status: response.status, details: `Groq ${response.status}: ${errorText.slice(0, 300)}` };
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    if (typeof choice?.message?.content !== 'string' || choice.finish_reason === 'length') {
      return { ok: false, details: `Groq: réponse vide ou tronquée (${choice?.finish_reason})` };
    }
    // Limites de l'offre Groq (par minute et par jour), utiles pour choisir l'ordre des fournisseurs
    const header = (name: string) => response.headers.get(name);
    return {
      ok: true,
      text: choice.message.content,
      usage: {
        ...data.usage,
        rate_limits: {
          requests_per_day: header('x-ratelimit-limit-requests'),
          remaining_requests: header('x-ratelimit-remaining-requests'),
          tokens_per_minute: header('x-ratelimit-limit-tokens'),
          remaining_tokens: header('x-ratelimit-remaining-tokens'),
        },
      },
    };
  } catch (error) {
    return { ok: false, details: `Groq: ${describeError(error)}` };
  }
}

// Groq refuse parfois sa propre sortie en mode JSON Schema strict (400 json_validate_failed).
// C'est aléatoire et rapide : on réessaie une fois.
export function groqProvider(options: {
  apiKey: string;
  model: string;
  timeoutMs: number;
  reasoningEffort: 'none' | 'low' | 'medium' | 'high';
}): AiProvider {
  return {
    name: 'groq',
    model: options.model,
    configured: options.apiKey !== '' && options.model !== '',
    call: async (request, signal) => {
      const first = await requestGroq(options, request, signal);
      if (first.ok || first.status !== 400 || !first.details.includes('json_validate_failed') || signal.aborted) return first;

      console.warn(`[ai] groq (${options.model}) json_validate_failed, nouvel essai : ${first.details.slice(0, 200)}`);
      const second = await requestGroq(options, request, signal);
      return second.ok ? second : { ...second, details: `${second.details} (après un nouvel essai sur json_validate_failed)` };
    },
  };
}

// ---------- Fournisseur principal et secours ----------

// Résultat de la lecture d'une réponse par la fonction appelante
export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; failure: string; code: FailureCode };

// ai_error : fournisseur injoignable ou en erreur ; invalid_response : réponse illisible ou non conforme
export type FailureCode = 'ai_error' | 'invalid_response';

export type FallbackResult<T> =
  | { ok: true; value: T; provider: AiProvider }
  | { ok: false; failure: string; code: FailureCode; provider: AiProvider };

// Journal des tentatives, renvoyé en mode debug (durées, tokens)
export interface AttemptLog {
  provider: string;
  started_at_ms: number;
  ms: number;
  ok: boolean;
  details?: string;
  usage?: unknown;
}

async function attempt<T>(
  provider: AiProvider,
  request: AiRequest,
  parse: (text: string) => ParseResult<T>,
  signal: AbortSignal,
  log: AttemptLog[],
  t0: number,
  label: string,
): Promise<FallbackResult<T>> {
  const started = Date.now();
  const result = await provider.call(request, signal);
  const entry: AttemptLog = { provider: provider.name, started_at_ms: started - t0, ms: Date.now() - started, ok: false, ...(result.ok && { usage: result.usage }) };
  log.push(entry);

  let outcome: FallbackResult<T>;
  if (!result.ok) {
    outcome = { ok: false, failure: result.details, code: 'ai_error', provider };
    if (result.status === 401 || result.status === 403) {
      // Pas une panne passagère : la clé est à corriger. On bascule quand même pour ne pas bloquer l'utilisateur.
      console.error(`[${label}] ${provider.name} (${provider.model}) CLÉ ${provider.name.toUpperCase()} INVALIDE (HTTP ${result.status}) : vérifier le secret de sa clé API`);
    }
  } else if (result.text.trim() === '') {
    outcome = { ok: false, failure: `${provider.name} : réponse vide`, code: 'invalid_response', provider };
  } else {
    const parsed = parse(result.text);
    outcome = parsed.ok
      ? { ok: true, value: parsed.value, provider }
      : { ok: false, failure: `${provider.name} : ${parsed.failure}`, code: parsed.code, provider };
  }

  if (!outcome.ok) {
    entry.details = outcome.failure.slice(0, 300);
    // Une annulation n'est pas une panne : l'autre fournisseur a déjà répondu
    if (!signal.aborted) console.error(`[${label}] ${provider.name} (${provider.model}) échec en ${entry.ms} ms : ${outcome.failure}`);
  } else {
    entry.ok = true;
  }
  return outcome;
}

export function runWithFallback<T>(
  providers: AiProvider[],
  request: AiRequest,
  parse: (text: string) => ParseResult<T>,
  options: { label: string; log: AttemptLog[]; t0: number; hedgeDelayMs?: number },
): Promise<FallbackResult<T>> {
  const controller = new AbortController();
  return new Promise((resolve) => {
    let next = 0;
    let pending = 0;
    let settled = false;
    let hedgeTimer: ReturnType<typeof setTimeout> | undefined;

    const finish = (result: FallbackResult<T>) => {
      settled = true;
      clearTimeout(hedgeTimer);
      controller.abort();
      resolve(result);
    };

    const startNext = () => {
      clearTimeout(hedgeTimer);
      if (settled || next >= providers.length) return;
      const provider = providers[next++];
      pending++;
      attempt(provider, request, parse, controller.signal, options.log, options.t0, options.label).then((result) => {
        pending--;
        if (settled) return;
        if (result.ok) return finish(result);
        if (next < providers.length) startNext();
        else if (pending === 0) finish(result);
      });
      if (options.hedgeDelayMs !== undefined && next < providers.length) {
        hedgeTimer = setTimeout(startNext, options.hedgeDelayMs);
      }
    };

    startNext();
  });
}

// Ordre des fournisseurs lu depuis un secret (ex. "groq,gemini") ; noms inconnus ignorés
export function orderProviders(providers: AiProvider[], order: string | undefined): AiProvider[] {
  const names = (order || '').split(',').map((name) => name.trim()).filter(Boolean);
  const ordered = names
    .map((name) => providers.find((provider) => provider.name === name))
    .filter((provider): provider is AiProvider => provider !== undefined);
  const rest = providers.filter((provider) => !ordered.includes(provider));
  return [...ordered, ...rest].filter((provider) => provider.configured);
}
