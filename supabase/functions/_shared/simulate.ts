// Erreurs de quota simulées, pour tester sans consommer les quotas : champ « simulate » du corps de la
// requête, pris en compte seulement avec l'en-tête x-simulate-key égal à la clé secrète (jamais depuis l'app).
//   { "user_quota": true }                              quota personnel atteint
//   { "providers": { "gemini": "quota", "groq": "error" } }   quota épuisé ou panne chez un fournisseur

import { SUPABASE_SECRET_KEY } from './keys.ts';
import type { SimulatedFailure } from './ai.ts';

export interface Simulation {
  user_quota: boolean;
  providers: Record<string, SimulatedFailure>;
}

export function readSimulation(req: Request, body: any): Simulation | null {
  if (!SUPABASE_SECRET_KEY || req.headers.get('x-simulate-key') !== SUPABASE_SECRET_KEY) return null;
  const raw = body?.simulate;
  if (!raw || typeof raw !== 'object') return null;
  const providers: Record<string, SimulatedFailure> = {};
  for (const [name, failure] of Object.entries(raw.providers ?? {})) {
    if (failure === 'quota' || failure === 'error') providers[name] = failure;
  }
  return { user_quota: raw.user_quota === true, providers };
}
