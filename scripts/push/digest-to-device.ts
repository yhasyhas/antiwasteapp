// Résumé quotidien d'essai envoyé à UN seul appareil, sans rien écrire en base : même texte (digestContent), même
// canal Android, même priorité que la fonction daily-digest, avec les vrais aliments du foyer de l'utilisateur
// (périmant aujourd'hui et demain, dans le fuseau de l'appareil). Utile pour vérifier les notifications d'un
// nouveau build sans attendre 9 h ni toucher à daily_digests (la simulation « force » de la fonction réécrit le
// résumé du jour et l'envoie à tous les appareils).
// Le reçu Expo est lu 20 s après l'envoi : « ok » veut dire que FCM a accepté la notification pour cet appareil
// (identifiants push du paquet en place). Clé secrète lue avec le CLI Supabase, jamais affichée.
// Lancement depuis la racine :
//   deno run --allow-run --allow-net --allow-read --allow-env scripts/push/digest-to-device.ts <user_id> <début du jeton>
// (début du jeton : quelques caractères après « ExponentPushToken[ », pour choisir l'appareil)
import { digestContent, type DigestItem, type FactNames, localFoodName } from '../../supabase/functions/_shared/digestText.ts';

const [userId, tokenStart] = Deno.args;
if (!userId || !tokenStart) throw new Error('usage : <user_id> <début du jeton>');

const env = Object.fromEntries(
  Deno.readTextFileSync('.env').split(/\r?\n/).filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
);
const URL_ = env.EXPO_PUBLIC_SUPABASE_URL;
const ref = new URL(URL_).hostname.split('.')[0];
const keys = new TextDecoder().decode(
  (await new Deno.Command('npx', { args: ['supabase', 'projects', 'api-keys', '--project-ref', ref, '--reveal', '-o', 'json'], stdout: 'piped', stderr: 'null' }).output()).stdout,
);
const SECRET = (JSON.parse(keys) as { type?: string; api_key: string }[]).find((k) => k.type === 'secret')?.api_key;
if (!SECRET) throw new Error('clé secrète introuvable');
const headers = { apikey: SECRET, Authorization: `Bearer ${SECRET}` };
const rest = async (path: string) => {
  const response = await fetch(`${URL_}/rest/v1/${path}`, { headers });
  if (!response.ok) throw new Error(`${path.split('?')[0]} : ${response.status}`);
  return response.json();
};

const tokens: { token: string; timezone: string; language: string }[] = await rest(`push_tokens?select=token,timezone,language&user_id=eq.${userId}`);
const device = tokens.find((t) => t.token.startsWith(`ExponentPushToken[${tokenStart}`));
if (!device) throw new Error(`aucun jeton de cet utilisateur ne commence par ${tokenStart}`);

// Foyer actif, comme public.active_household_of : le foyer partagé le plus ancien, sinon le foyer personnel
const memberships: { household_id: string; households: { is_personal: boolean } }[] = await rest(
  `household_members?select=household_id,joined_at,households(is_personal)&user_id=eq.${userId}&order=joined_at`,
);
const householdId = memberships.find((m) => !m.households.is_personal)?.household_id
  ?? (await rest(`households?select=id&created_by=eq.${userId}&is_personal=is.true`))[0]?.id;
if (!householdId) throw new Error('foyer introuvable');
const localDate = new Intl.DateTimeFormat('en-CA', { timeZone: device.timezone }).format(new Date());
const tomorrowDate = new Date(Date.parse(`${localDate}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
const pantry: { id: string; name: string; expires_at: string | null; location: string | null; food_key: string | null; kind: string | null; barcode: string | null }[] =
  await rest(`ingredients?select=id,name,expires_at,location,food_key,kind,barcode&household_id=eq.${householdId}&order=name`);
// Noms dans la langue de l'appareil, comme la fonction (localizeDigests) et l'app
const factKeys = [...new Set(pantry.map((i) => i.food_key).filter((key): key is string => !!key))];
const facts: ({ food_key: string } & FactNames)[] = factKeys.length
  ? await rest(`food_facts?select=food_key,fr:content->fr->>name,en:content->en->>name,es:content->es->>name&food_key=in.(${encodeURIComponent(factKeys.map((k) => `"${k}"`).join(','))})`)
  : [];
const namesByKey = new Map(facts.map((fact) => [fact.food_key, fact]));
// Congélateur jamais dans le résumé (claim_daily_digests)
const pick = (date: string): DigestItem[] => pantry.filter((i) => i.expires_at === date && i.location !== 'freezer')
  .map((i) => ({ id: i.id, name: localFoodName(i, i.food_key ? namesByKey.get(i.food_key) : null, device.language) }));
const today = pick(localDate);
const tomorrow = pick(tomorrowDate);
console.log(`foyer : ${pantry.length} aliments ; aujourd'hui (${localDate}) : ${today.length} ; demain : ${tomorrow.length} ; langue : ${device.language}`);

// Comme claim_daily_digests : rien qui périme aujourd'hui ou demain, pas de notification
if (today.length + tomorrow.length === 0) {
  console.log('Rien ne périme aujourd’hui ni demain : la fonction n’enverrait aucune notification. Rien envoyé.');
  Deno.exit(0);
}
const content = digestContent(today, tomorrow, pantry.length, device.language);
console.log(`titre : ${content.title}\ntexte : ${content.body}`);

const ticket = await (await fetch('https://exp.host/--/api/v2/push/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ to: device.token, ...content, channelId: 'expiry', sound: 'default', priority: 'high' }),
})).json();
const sent = ticket.data;
console.log('ticket Expo :', sent?.status, sent?.message ?? '');
if (sent?.status !== 'ok') Deno.exit(1);

await new Promise((r) => setTimeout(r, 20_000));
const receipts = await (await fetch('https://exp.host/--/api/v2/push/getReceipts', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ids: [sent.id] }),
})).json();
const receipt = receipts.data?.[sent.id];
console.log('reçu Expo (FCM) :', receipt?.status ?? 'pas encore disponible', receipt?.details?.error ?? '', receipt?.message ?? '');
