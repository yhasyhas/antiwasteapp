import type { TFunction } from 'i18next';
import { colors } from '@/constants/theme';

// Dates de péremption, au format de la colonne `expires_at` (date sans heure, 'AAAA-MM-JJ'),
// toujours calculées dans le fuseau du téléphone.

export type ExpiryStatus = 'expired' | 'soon' | 'ok' | 'none';
export type FoodKind = 'ingredient' | 'dish';

// « Bientôt » : aujourd'hui, demain ou après-demain
export const SOON_DAYS = 2;
// Dates proposées quand l'IA n'a rien estimé (ajout manuel)
export const DEFAULT_SHELF_LIFE_DAYS = 7;
export const LEFTOVER_SHELF_LIFE_DAYS = 3;

const pad = (n: number) => String(n).padStart(2, '0');

export function toISODate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// 'AAAA-MM-JJ' → Date à minuit, heure locale (new Date('AAAA-MM-JJ') serait en UTC)
export function fromISODate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function todayISO(): string {
  return toISODate(new Date());
}

// Horodatage ("2026-10-01T18:20:00Z") → date locale 'AAAA-MM-JJ'
export const localDateOf = (timestamp: string) => toISODate(new Date(timestamp));
export const isToday = (timestamp: string) => localDateOf(timestamp) === todayISO();

export function addDays(iso: string, days: number): string {
  const date = fromISODate(iso);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

export function addMonths(iso: string, months: number): string {
  const date = fromISODate(iso);
  const day = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + months);
  // 31 janvier + 1 mois → dernier jour de février
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(day, lastDay));
  return toISODate(date);
}

export function expiryFromShelfLife(days: number | undefined, kind: FoodKind = 'ingredient'): string {
  const fallback = kind === 'dish' ? LEFTOVER_SHELF_LIFE_DAYS : DEFAULT_SHELF_LIFE_DAYS;
  return addDays(todayISO(), typeof days === 'number' && days > 0 ? days : fallback);
}

// Jours restants : 0 aujourd'hui, 1 demain, négatif si la date est passée
export function daysUntil(iso: string): number {
  const ms = fromISODate(iso).getTime() - fromISODate(todayISO()).getTime();
  return Math.round(ms / 86_400_000);
}

export function expiryStatus(iso: string | null | undefined): ExpiryStatus {
  if (!iso) return 'none';
  const days = daysUntil(iso);
  if (days < 0) return 'expired';
  if (days <= SOON_DAYS) return 'soon';
  return 'ok';
}

// Nombre de jours jusqu'auquel la date est dite relative (« Dans 7 jours ») ; au-delà, la date réelle
export const RELATIVE_DAYS = 7;

// Texte court : « Expiré », « Aujourd'hui », « Demain », « Dans 5 jours » jusqu'à 7 jours, puis la date réelle
// dans le format de la langue (« 12 oct. », avec l'année si ce n'est pas l'année en cours)
// short : libellé des badges (« Aujourd'hui », « Demain »)
export function expiryLabel(t: TFunction, iso: string | null | undefined, language: string, short = true): string {
  if (!iso) return t('expiry.none');
  const days = daysUntil(iso);
  if (days < 0) return t('expiry.expiredDaysAgo', { count: -days });
  if (days === 0) return short ? t('expiry.todayShort') : t('expiry.today');
  if (days === 1) return short ? t('expiry.tomorrowShort') : t('expiry.tomorrow');
  if (days <= RELATIVE_DAYS) return t('expiry.inDays', { count: days });
  return shortDate(iso, language);
}

// « 12 oct. » ; « 12 oct. 2027 » pour une autre année
export function shortDate(iso: string, language: string): string {
  const date = fromISODate(iso);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(language, { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) });
}

export function formatDate(iso: string, language: string): string {
  return fromISODate(iso).toLocaleDateString(language, { day: 'numeric', month: 'short', year: 'numeric' });
}

// Garde-manger trié par urgence : expirés et proches d'abord, sans date à la fin, puis les plus récents
export function sortByUrgency<T extends { expires_at?: string | null; created_at: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (a.expires_at && b.expires_at && a.expires_at !== b.expires_at) return a.expires_at < b.expires_at ? -1 : 1;
    if (a.expires_at && !b.expires_at) return -1;
    if (!a.expires_at && b.expires_at) return 1;
    return b.created_at.localeCompare(a.created_at);
  });
}

// Couleurs des états (jetons du thème)
export const EXPIRY_COLORS: Record<ExpiryStatus, { background: string; text: string }> = {
  expired: colors.expired,
  soon: colors.soon,
  ok: colors.ok,
  none: { background: colors.primarySoft, text: colors.textSecondary },
};

// Durée courte jusqu'à la date (confirmation du scan) : « 5 jours », « 2 sem. », « 3 mois »
export function shortDuration(t: TFunction, iso: string): string {
  const days = Math.max(0, daysUntil(iso));
  if (days < 14) return t('expiry.days', { count: days });
  if (days < 60) return t('expiry.weeks', { count: Math.round(days / 7) });
  return t('expiry.months', { count: Math.round(days / 30) });
}

// Produit emballé scanné par code-barres (non ouvert) : durée par défaut selon la catégorie, en jours.
// Simple point de départ : l'utilisateur recopie la date imprimée sur l'emballage.
const PACKAGED_SHELF_LIFE_DAYS: Record<string, number> = {
  fruit: 5, vegetable: 5, meat: 3, fish: 2, dairy: 10, egg: 21, grain: 365, legume: 365,
  bakery: 5, condiment: 180, spice: 365, beverage: 180, snack: 120, frozen: 90, other: 30,
};

export function expiryForPackagedProduct(category: string | null | undefined): string {
  return addDays(todayISO(), PACKAGED_SHELF_LIFE_DAYS[category ?? 'other'] ?? PACKAGED_SHELF_LIFE_DAYS.other);
}

// Date d'ajout d'un lot (horodatage), par rapport à aujourd'hui : « aujourd'hui », « hier », « il y a 3 jours »,
// puis la date au-delà d'un mois
export function addedWhen(t: TFunction, createdAt: string, language: string): string {
  const day = toISODate(new Date(createdAt));
  const days = Math.max(0, -daysUntil(day));
  if (days === 0) return t('existing.addedToday');
  if (days === 1) return t('existing.addedYesterday');
  if (days <= 31) return t('existing.addedDaysAgo', { count: days });
  return t('existing.addedOn', { date: formatDate(day, language) });
}
