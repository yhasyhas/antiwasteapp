import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { notifyPantryChanged } from './pantryEvents';

// Foyer actif de l'utilisateur connecté (son foyer partagé s'il en a un, sinon son foyer personnel) :
// un seul état partagé par toute l'app, lu par useHousehold. Toutes les écritures passent par les
// fonctions SQL du foyer (migration shared_households). En temps réel, chaque changement du garde-manger
// ou des membres arrive sur le canal privé household:<id>, reçu seulement par les membres.

export interface HouseholdMember {
  user_id: string;
  name: string;
  role: 'owner' | 'member';
  joined_at: string;
  is_me: boolean;
}

export interface Household {
  id: string;
  shared: boolean;
  role: 'owner' | 'member';
  max_members: number;
  members: HouseholdMember[];
  invite: { code: string; expires_at: string } | null;
}

// Codes d'erreur renvoyés par les fonctions SQL (traduits par l'app : household.errors.*)
export const HOUSEHOLD_ERRORS = [
  'invalid_code', 'expired_code', 'already_member', 'already_in_household', 'household_full',
  'not_in_shared_household', 'not_owner', 'cannot_remove_self', 'not_a_member',
] as const;
export type HouseholdError = (typeof HOUSEHOLD_ERRORS)[number] | 'unknown';

export class HouseholdActionError extends Error {
  constructor(public code: HouseholdError, message: string) {
    super(message);
  }
}

function toError(error: { message: string }): HouseholdActionError {
  const code = (HOUSEHOLD_ERRORS as readonly string[]).includes(error.message) ? (error.message as HouseholdError) : 'unknown';
  if (code === 'unknown') console.warn('[foyer] erreur :', error.message);
  return new HouseholdActionError(code, error.message);
}

let current: Household | null = null;
let userId: string | null = null;
let loading: Promise<Household | null> | null = null;
let channel: RealtimeChannel | null = null;
const listeners = new Set<() => void>();

function setHousehold(next: Household | null) {
  const previousId = current?.id;
  current = next;
  if (next?.id !== previousId) {
    subscribeRealtime(next?.id ?? null);
    // Autre foyer actif : autre garde-manger (écrans, rappels)
    if (previousId) notifyPantryChanged();
  }
  listeners.forEach((listener) => listener());
}

export function subscribeHousehold(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const getHousehold = () => current;

// Recharge le foyer depuis le serveur (connexion, retour dans l'app, changement des membres)
export function loadHousehold(): Promise<Household | null> {
  if (!userId) return Promise.resolve(null);
  const forUser = userId;
  const request = (async () => {
    const { data, error } = await supabase.rpc('my_household');
    // Déconnecté entre-temps : réponse ignorée
    if (userId !== forUser) return current;
    if (error) {
      console.warn('[foyer] chargement impossible :', error.message);
      return current;
    }
    setHousehold((data as Household | null) ?? null);
    return current;
  })();
  loading = request;
  request.finally(() => {
    if (loading === request) loading = null;
  });
  return request;
}

// Identifiant du foyer actif, pour filtrer le garde-manger (attend le premier chargement)
export async function activeHouseholdId(): Promise<string | null> {
  if (current) return current.id;
  return (loading ?? loadHousehold()).then((household) => household?.id ?? null);
}

// Utilisateur connecté (ou déconnecté : null)
export function setHouseholdUser(nextUserId: string | null) {
  if (nextUserId === userId) return;
  userId = nextUserId;
  setHousehold(null);
  if (nextUserId) loadHousehold();
}

function subscribeRealtime(householdId: string | null) {
  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
  }
  if (!householdId) return;
  const next = supabase.channel(`household:${householdId}`, { config: { private: true } });
  channel = next;
  // Jeton de l'utilisateur pour le canal privé, puis abonnement
  supabase.realtime.setAuth().then(() => {
    if (channel !== next) return;
    next
      .on('broadcast', { event: 'pantry' }, () => notifyPantryChanged())
      .on('broadcast', { event: 'members' }, () => loadHousehold())
      .subscribe((status, error) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') console.warn('[foyer] temps réel :', status, error?.message ?? '');
      });
  });
}

async function rpc<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw toError(error);
  return data as T;
}

export async function createInvite(): Promise<{ code: string; expires_at: string }> {
  const invite = await rpc<{ code: string; expires_at: string }>('create_household_invite');
  await loadHousehold();
  return invite;
}

export const previewInvite = (code: string) =>
  rpc<{ invited_by: string | null; member_count: number }>('preview_household_invite', { p_code: code.trim().toUpperCase() });

export async function joinHousehold(code: string, transfer: boolean): Promise<void> {
  await rpc('join_household', { p_code: code.trim().toUpperCase(), p_transfer: transfer });
  await loadHousehold();
  notifyPantryChanged();
}

export async function leaveHousehold(): Promise<void> {
  await rpc('leave_household');
  await loadHousehold();
}

export async function removeMember(memberId: string): Promise<void> {
  await rpc('remove_household_member', { p_user_id: memberId });
  await loadHousehold();
}

// Nom affiché aux membres du foyer (vide : début de l'adresse e-mail)
export async function setDisplayName(name: string): Promise<void> {
  if (!userId) return;
  const { error } = await supabase.from('profiles').update({ display_name: name.trim() || null }).eq('id', userId);
  if (error) throw toError(error);
  await loadHousehold();
}

// Nombre d'aliments du foyer personnel (proposition de transfert en rejoignant un foyer)
export async function personalPantryCount(): Promise<number> {
  if (!userId || current?.shared) return 0;
  const { count } = await supabase
    .from('ingredients')
    .select('id', { count: 'exact', head: true })
    .eq('household_id', current?.id ?? '');
  return count ?? 0;
}
