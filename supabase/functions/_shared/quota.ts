// Quotas par jour (UTC) et par utilisateur, comptés dans la table usage_counters
// (migration 20260925100000). Les fonctions SQL ne sont appelables qu'avec la clé secrète.

import { SUPABASE_SECRET_KEY, SUPABASE_URL } from './keys.ts';

export type QuotaKind = 'scans' | 'generations' | 'images';

// Limites réglables par secret, sans redéployer
export const DAILY_LIMITS: Record<QuotaKind, number> = {
  scans: Number(Deno.env.get('QUOTA_DAILY_SCANS') || 20),
  generations: Number(Deno.env.get('QUOTA_DAILY_GENERATIONS') || 10),
  // Images de recettes (Cloudflare Workers AI : environ 10 000 neurones gratuits par jour pour tout le compte)
  images: Number(Deno.env.get('QUOTA_DAILY_IMAGES') || 10),
};

async function rpc(name: string, args: Record<string, unknown>): Promise<unknown> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_SECRET_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!response.ok) {
    throw new Error(`${name} : HTTP ${response.status} ${(await response.text()).slice(0, 200)}`);
  }
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

// Compte une utilisation. Renvoie false si la limite du jour est déjà atteinte (rien n'est compté).
export async function consumeQuota(userId: string, kind: QuotaKind): Promise<boolean> {
  return await rpc('consume_quota', { p_user_id: userId, p_kind: kind, p_limit: DAILY_LIMITS[kind] }) === true;
}

// Rend l'utilisation quand l'IA a échoué sans rien renvoyer à l'utilisateur
export async function refundQuota(userId: string, kind: QuotaKind): Promise<void> {
  try {
    await rpc('refund_quota', { p_user_id: userId, p_kind: kind });
  } catch (error) {
    console.error('[quota] remboursement impossible :', error);
  }
}
