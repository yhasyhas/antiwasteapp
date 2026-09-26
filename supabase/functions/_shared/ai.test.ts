// Tests de la logique de secours (runWithFallback, orderProviders), avec de faux fournisseurs.
// Lancement : deno test --no-config supabase/functions/

import { assert, assertEquals } from 'jsr:@std/assert@1';
import { type AiProvider, type AiRequest, type AttemptLog, classifyProviderFailure, orderProviders, type ParseResult, type ProviderResult, runWithFallback } from './ai.ts';

const REQUEST: AiRequest = { prompt: 'test', schema: {}, schemaName: 'test', temperature: 0, maxOutputTokens: 100 };

// Faux fournisseur : répond `result` après `delayMs`, et note s'il a été annulé
function fakeProvider(name: string, delayMs: number, result: ProviderResult, configured = true) {
  const state = { calls: 0, aborted: false };
  const provider: AiProvider = {
    name,
    model: `${name}-model`,
    configured,
    call: (_request, signal) => {
      state.calls++;
      return new Promise((resolve) => {
        const timer = setTimeout(() => resolve(result), delayMs);
        signal.addEventListener('abort', () => {
          state.aborted = true;
          clearTimeout(timer);
          resolve({ ok: false, details: `${name}: AbortError` });
        });
      });
    },
  };
  return { provider, state };
}

const ok = (text: string): ProviderResult => ({ ok: true, text });
const httpError = (status: number): ProviderResult => ({ ok: false, status, details: `HTTP ${status}` });

// Lecture de test : accepte {"value": "..."} ; "INVALIDE" simule une réponse non conforme
function parse(text: string): ParseResult<string> {
  if (text === 'INVALIDE') return { ok: false, failure: 'non conforme', code: 'invalid_response' };
  return { ok: true, value: JSON.parse(text).value };
}

function run(providers: AiProvider[], hedgeDelayMs?: number) {
  const log: AttemptLog[] = [];
  return runWithFallback(providers, REQUEST, parse, { label: 'test', log, t0: Date.now(), hedgeDelayMs }).then((result) => ({ result, log }));
}

Deno.test('le fournisseur principal répond : le secours n\'est pas appelé', async () => {
  const primary = fakeProvider('gemini', 5, ok('{"value":"a"}'));
  const backup = fakeProvider('groq', 5, ok('{"value":"b"}'));
  const { result } = await run([primary.provider, backup.provider]);
  assert(result.ok);
  assertEquals(result.value, 'a');
  assertEquals(result.provider.name, 'gemini');
  assertEquals(backup.state.calls, 0);
});

Deno.test('erreur HTTP du principal : bascule sur le secours', async () => {
  const primary = fakeProvider('gemini', 5, httpError(503));
  const backup = fakeProvider('groq', 5, ok('{"value":"b"}'));
  const { result, log } = await run([primary.provider, backup.provider]);
  assert(result.ok);
  assertEquals(result.provider.name, 'groq');
  assertEquals(log.map((a) => [a.provider, a.ok]), [['gemini', false], ['groq', true]]);
});

Deno.test('réponse non conforme ou vide du principal : bascule sur le secours', async () => {
  for (const bad of [ok('INVALIDE'), ok('   ')]) {
    const primary = fakeProvider('gemini', 5, bad);
    const backup = fakeProvider('groq', 5, ok('{"value":"b"}'));
    const { result } = await run([primary.provider, backup.provider]);
    assert(result.ok);
    assertEquals(result.provider.name, 'groq');
  }
});

Deno.test('les deux fournisseurs échouent : échec avec la raison et le code du dernier', async () => {
  const primary = fakeProvider('gemini', 5, httpError(500));
  const backup = fakeProvider('groq', 5, ok('INVALIDE'));
  const { result } = await run([primary.provider, backup.provider]);
  assert(!result.ok);
  assertEquals(result.code, 'invalid_response');
  assert(result.failure.startsWith('groq'));
});

Deno.test('lancement en parallèle : principal trop lent, le secours l\'emporte et le principal est annulé', async () => {
  const primary = fakeProvider('gemini', 300, ok('{"value":"a"}'));
  const backup = fakeProvider('groq', 10, ok('{"value":"b"}'));
  const { result } = await run([primary.provider, backup.provider], 50);
  assert(result.ok);
  assertEquals(result.provider.name, 'groq');
  assert(primary.state.aborted, 'le principal doit être annulé');
});

Deno.test('lancement en parallèle : le principal répond avant le délai, le secours n\'est pas lancé', async () => {
  const primary = fakeProvider('gemini', 10, ok('{"value":"a"}'));
  const backup = fakeProvider('groq', 10, ok('{"value":"b"}'));
  const { result } = await run([primary.provider, backup.provider], 100);
  assert(result.ok);
  assertEquals(result.provider.name, 'gemini');
  assertEquals(backup.state.calls, 0);
});

Deno.test('lancement en parallèle : le secours échoue, on attend le principal', async () => {
  const primary = fakeProvider('gemini', 150, ok('{"value":"a"}'));
  const backup = fakeProvider('groq', 10, httpError(429));
  const { result } = await run([primary.provider, backup.provider], 30);
  assert(result.ok);
  assertEquals(result.provider.name, 'gemini');
});

Deno.test('lancement en parallèle : le principal échoue avant le délai, le secours part aussitôt', async () => {
  const primary = fakeProvider('gemini', 5, httpError(404));
  const backup = fakeProvider('groq', 5, ok('{"value":"b"}'));
  const started = Date.now();
  const { result } = await run([primary.provider, backup.provider], 1000);
  assert(result.ok);
  assertEquals(result.provider.name, 'groq');
  assert(Date.now() - started < 500, 'le secours ne doit pas attendre le délai');
});

Deno.test('orderProviders : ordre du secret, noms inconnus ignorés, fournisseurs non configurés retirés', () => {
  const gemini = fakeProvider('gemini', 0, ok('{}')).provider;
  const groq = fakeProvider('groq', 0, ok('{}')).provider;
  const off = fakeProvider('autre', 0, ok('{}'), false).provider;
  assertEquals(orderProviders([gemini, groq], 'groq,gemini').map((p) => p.name), ['groq', 'gemini']);
  assertEquals(orderProviders([gemini, groq], 'inconnu, groq').map((p) => p.name), ['groq', 'gemini']);
  assertEquals(orderProviders([gemini, groq], undefined).map((p) => p.name), ['gemini', 'groq']);
  assertEquals(orderProviders([off, groq], 'autre,groq').map((p) => p.name), ['groq']);
});

// ---------- Quotas des fournisseurs ----------

Deno.test('classification : erreurs de quota de Gemini, Groq et Cloudflare ; le reste est une panne', () => {
  assertEquals(classifyProviderFailure(429, 'Gemini 429: {\"error\":{\"status\":\"RESOURCE_EXHAUSTED\"}}'), 'provider_quota');
  assertEquals(classifyProviderFailure(429, 'Groq 429: {\"error\":{\"code\":\"rate_limit_exceeded\"}}'), 'provider_quota');
  assertEquals(classifyProviderFailure(400, 'Cloudflare 400: {\"errors\":[{\"message\":\"AiError: you have used up your daily free allocation of 10,000 neurons\",\"code\":3036}]}'), 'provider_quota');
  assertEquals(classifyProviderFailure(undefined, 'Gemini status RESOURCE_EXHAUSTED'), 'provider_quota');
  assertEquals(classifyProviderFailure(503, 'Gemini 503: {\"status\":\"UNAVAILABLE\",\"message\":\"The model is overloaded\"}'), 'provider_error');
  assertEquals(classifyProviderFailure(500, 'Groq 500: internal error'), 'provider_error');
  assertEquals(classifyProviderFailure(undefined, 'Gemini: TimeoutError: Signal timed out.'), 'provider_error');
});

Deno.test('quota épuisé chez le principal, le secours répond : succès, quota signalé', async () => {
  const primary = fakeProvider('gemini', 5, httpError(429));
  const backup = fakeProvider('groq', 5, ok('{"value":"b"}'));
  const { result } = await run([primary.provider, backup.provider]);
  assert(result.ok);
  assertEquals(result.quotaHits.map((hit) => hit.provider), ['gemini']);
});

Deno.test('tous les fournisseurs à court de quota : raison provider_quota', async () => {
  const { result } = await run([fakeProvider('gemini', 5, httpError(429)).provider, fakeProvider('groq', 5, httpError(429)).provider]);
  assert(!result.ok);
  assertEquals(result.reason, 'provider_quota');
  assertEquals(result.quotaHits.length, 2);
});

Deno.test("quota chez l'un, panne chez l'autre : raison provider_error, quota tout de même signalé", async () => {
  const { result } = await run([fakeProvider('gemini', 5, httpError(429)).provider, fakeProvider('groq', 5, httpError(500)).provider]);
  assert(!result.ok);
  assertEquals(result.reason, 'provider_error');
  assertEquals(result.quotaHits.map((hit) => hit.provider), ['gemini']);
});

Deno.test('simulation : aucun appel réel au fournisseur simulé', async () => {
  const primary = fakeProvider('gemini', 5, ok('{"value":"a"}'));
  const backup = fakeProvider('groq', 5, ok('{"value":"b"}'));
  const log: AttemptLog[] = [];
  const result = await runWithFallback([primary.provider, backup.provider], REQUEST, parse, { label: 'test', log, t0: Date.now(), simulate: { gemini: 'quota' } });
  assert(result.ok);
  assertEquals(result.value, 'b');
  assertEquals(primary.state.calls, 0);
  assertEquals(result.quotaHits.map((hit) => hit.provider), ['gemini']);
});
