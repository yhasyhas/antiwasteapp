import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { SUPABASE_SECRET_KEY, SUPABASE_URL } from '../_shared/keys.ts';
import { digestContent, type DigestItem } from '../_shared/digestText.ts';
import { reportPushFailure } from '../_shared/quotaAlerts.ts';

// Résumé quotidien à 9 h (heure locale de chaque utilisateur), envoyé par Expo Push. Appelée toutes les
// 15 minutes par pg_cron (migration daily_digest), avec l'en-tête x-cron-secret égal au secret CRON_SECRET.
// 1. Reçus des envois d'il y a plus de 15 minutes (erreurs d'Android / FCM, appareils désinstallés).
// 2. Résumés dus maintenant, réservés en base (claim_daily_digests : jamais deux fois le même jour),
//    envoyés à tous les appareils de l'utilisateur. Rien à signaler : aucune notification.
// Échec d'envoi : alerte Sentry une fois par jour (reportPushFailure), comme les quotas.
// Essais (clé secrète en x-simulate-key) : { "simulate": { "user_id": "…", "force": true, "push": "error" } }

const CRON_SECRET = Deno.env.get('CRON_SECRET') || '';
// Facultatif : jeton d'accès Expo si la sécurité renforcée des notifications est activée sur le projet
const EXPO_ACCESS_TOKEN = Deno.env.get('EXPO_ACCESS_TOKEN') || '';
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push';
const FUNCTION_NAME = 'daily-digest';
const DIGEST_HOUR = 9;
// Android : canal créé par l'app (lib/notifications.ts)
const CHANNEL_ID = 'expiry';
const BATCH_SIZE = 100;
const RECEIPT_DELAY_MS = 15 * 60 * 1000;

interface DueDigest {
  user_id: string;
  local_date: string;
  language: string;
  tokens: string[];
  today: DigestItem[];
  tomorrow: DigestItem[];
  pantry_size: number;
}

interface Ticket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

const dbHeaders = { apikey: SUPABASE_SECRET_KEY, 'Content-Type': 'application/json' };
const expoHeaders = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
  ...(EXPO_ACCESS_TOKEN && { Authorization: `Bearer ${EXPO_ACCESS_TOKEN}` }),
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

async function db(path: string, init: RequestInit = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: { ...dbHeaders, ...(init.headers ?? {}) } });
  if (!response.ok) throw new Error(`base : HTTP ${response.status} ${(await response.text()).slice(0, 200)}`);
  return response.status === 204 ? null : response.json();
}

const digestFilter = (userId: string, localDate: string) =>
  `user_id=eq.${encodeURIComponent(userId)}&local_date=eq.${encodeURIComponent(localDate)}`;

async function removeTokens(tokens: string[]) {
  if (tokens.length === 0) return;
  const list = tokens.map((token) => `"${token}"`).join(',');
  await db(`push_tokens?token=in.(${encodeURIComponent(list)})`, { method: 'DELETE' });
  console.log(`[push] ${tokens.length} appareil(s) désinscrit(s) (DeviceNotRegistered)`);
}

async function expoPost(path: string, body: unknown) {
  const response = await fetch(`${EXPO_PUSH_URL}/${path}`, { method: 'POST', headers: expoHeaders, body: JSON.stringify(body), signal: AbortSignal.timeout(15_000) });
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.errors) throw new Error(`Expo Push ${path} : HTTP ${response.status} ${JSON.stringify(data?.errors ?? data).slice(0, 300)}`);
  return data?.data;
}

// 1. Reçus : erreurs signalées après coup par Android (FCM) ou Apple
async function checkReceipts(problems: string[]): Promise<number> {
  const before = new Date(Date.now() - RECEIPT_DELAY_MS).toISOString();
  const rows: { user_id: string; local_date: string; ticket_ids: string[] }[] = await db(
    `daily_digests?select=user_id,local_date,ticket_ids&status=eq.sent&receipts_checked=is.false&sent_at=lt.${encodeURIComponent(before)}&limit=300`,
  );
  if (rows.length === 0) return 0;
  // Chaque entrée : « <identifiant du reçu> <jeton> »
  const tokenOf = new Map<string, string>();
  for (const row of rows) for (const entry of row.ticket_ids) {
    const [id, token] = entry.split(' ');
    if (id) tokenOf.set(id, token ?? '');
  }
  const ids = [...tokenOf.keys()];
  const unregistered: string[] = [];
  for (let i = 0; i < ids.length; i += 300) {
    const receipts: Record<string, Ticket> = await expoPost('getReceipts', { ids: ids.slice(i, i + 300) });
    for (const [id, receipt] of Object.entries(receipts ?? {})) {
      if (receipt.status !== 'error') continue;
      if (receipt.details?.error === 'DeviceNotRegistered') unregistered.push(tokenOf.get(id)!);
      else problems.push(`reçu ${receipt.details?.error ?? ''} ${receipt.message ?? ''}`.trim());
    }
  }
  await removeTokens(unregistered.filter(Boolean));
  for (const row of rows) {
    await db(`daily_digests?${digestFilter(row.user_id, row.local_date)}`, { method: 'PATCH', body: JSON.stringify({ receipts_checked: true }) });
  }
  return rows.length;
}

// 2. Envoi des résumés dus
async function sendDigests(digests: DueDigest[], problems: string[], simulatePushError: boolean) {
  const messages = digests.flatMap((digest) => {
    const content = digestContent(digest.today, digest.tomorrow, digest.pantry_size, digest.language);
    return digest.tokens.map((token) => ({
      digest,
      token,
      message: { to: token, ...content, channelId: CHANNEL_ID, sound: 'default', priority: 'high' },
    }));
  });

  const tickets = new Map<typeof messages[number], Ticket>();
  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const batch = messages.slice(i, i + BATCH_SIZE);
    try {
      if (simulatePushError) throw new Error('Expo Push : échec simulé');
      const data: Ticket[] = await expoPost('send', batch.map((entry) => entry.message));
      batch.forEach((entry, index) => tickets.set(entry, data?.[index] ?? { status: 'error', message: 'ticket absent' }));
    } catch (error) {
      problems.push(String(error instanceof Error ? error.message : error));
      batch.forEach((entry) => tickets.set(entry, { status: 'error', message: 'envoi impossible' }));
    }
  }

  const unregistered: string[] = [];
  let sent = 0;
  for (const digest of digests) {
    const own = messages.filter((entry) => entry.digest === digest);
    const ok = own.filter((entry) => tickets.get(entry)?.status === 'ok');
    const errors = own.map((entry) => ({ entry, ticket: tickets.get(entry)! })).filter(({ ticket }) => ticket.status === 'error');
    for (const { entry, ticket } of errors) {
      if (ticket.details?.error === 'DeviceNotRegistered') unregistered.push(entry.token);
      else if (ticket.message !== 'envoi impossible') problems.push(`ticket ${ticket.details?.error ?? ''} ${ticket.message ?? ''}`.trim());
    }
    if (ok.length > 0) sent++;
    await db(`daily_digests?${digestFilter(digest.user_id, digest.local_date)}`, {
      method: 'PATCH',
      body: JSON.stringify(ok.length > 0
        ? { status: 'sent', sent_at: new Date().toISOString(), ticket_ids: ok.map((entry) => `${tickets.get(entry)!.id} ${entry.token}`), error: null }
        : { status: 'failed', error: (errors[0]?.ticket.message ?? 'aucun appareil').slice(0, 500) }),
    });
  }
  await removeTokens(unregistered);
  return { sent, failed: digests.length - sent, unregistered: unregistered.length };
}

Deno.serve(async (req) => {
  const fromCron = CRON_SECRET !== '' && req.headers.get('x-cron-secret') === CRON_SECRET;
  const test = req.headers.get('x-simulate-key') === SUPABASE_SECRET_KEY;
  if (!fromCron && !test) return json({ error: 'unauthorized' }, 401);

  const body = await req.json().catch(() => ({}));
  const simulate = test ? body?.simulate ?? {} : {};
  const problems: string[] = [];

  try {
    const receiptsChecked = await checkReceipts(problems);
    const digests: DueDigest[] = await db('rpc/claim_daily_digests', {
      method: 'POST',
      body: JSON.stringify({
        p_hour: DIGEST_HOUR,
        p_only_user: typeof simulate.user_id === 'string' ? simulate.user_id : null,
        p_force: simulate.force === true,
      }),
    });
    const result = await sendDigests(digests, problems, simulate.push === 'error');
    if (problems.length > 0) await reportPushFailure(FUNCTION_NAME, problems.slice(0, 5).join(' | '), test);
    console.log(`[push] résumés : ${digests.length} dus, ${result.sent} envoyés, ${result.failed} en échec ; ${receiptsChecked} reçus vérifiés`);
    return json({ due: digests.length, ...result, receipts_checked: receiptsChecked, problems: problems.length });
  } catch (error) {
    const message = String(error instanceof Error ? error.message : error);
    await reportPushFailure(FUNCTION_NAME, message, test);
    return json({ error: 'digest_failed' }, 500);
  }
});
