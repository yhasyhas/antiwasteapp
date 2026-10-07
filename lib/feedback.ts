import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { callEdgeFunction } from './callEdgeFunction';
import { buildInfo } from './buildInfo';
import { technicalVersion } from './buildLabel';
import type { RecipeRatingValue } from '@/components/recipe/types';

// Retours des utilisateurs : notes des recettes (« On a aimé » / « Pas pour nous »), signalements de recettes et
// « Donner mon avis ». Les deux derniers passent par la fonction send-feedback (enregistrement et email via Sentry).

// ---------- Notes ----------
// Partagées par la fiche recette et la fin du mode cuisine : une note donnée à l'un se voit dans l'autre
const ratings = new Map<string, RecipeRatingValue | null>();
const listeners = new Set<() => void>();
let version = 0;

function setLocalRating(recipeId: string, rating: RecipeRatingValue | null) {
  ratings.set(recipeId, rating);
  version++;
  listeners.forEach((listener) => listener());
}

// Note connue de la recette : celle donnée pendant la session, sinon celle lue en base (initial)
export function useRecipeRating(recipeId: string | undefined, initial: RecipeRatingValue | null | undefined): RecipeRatingValue | null | undefined {
  useSyncExternalStore((listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, () => version);
  return recipeId && ratings.has(recipeId) ? ratings.get(recipeId) : initial;
}

// Note lue en base (fin du mode cuisine : la séance ne la garde pas)
export async function loadRecipeRating(recipeId: string): Promise<RecipeRatingValue | null> {
  const { data } = await supabase.from('recipes').select('rating').eq('id', recipeId).maybeSingle();
  const rating = data?.rating === 'liked' || data?.rating === 'disliked' ? data.rating : null;
  if (!ratings.has(recipeId)) setLocalRating(recipeId, rating);
  return rating;
}

// Enregistre la note (null : retire l'avis) ; false si l'écriture a échoué (la note affichée revient en arrière)
export async function saveRecipeRating(recipeId: string, rating: RecipeRatingValue | null, previous: RecipeRatingValue | null): Promise<boolean> {
  setLocalRating(recipeId, rating);
  const { error } = await supabase.from('recipes').update({ rating, rated_at: rating ? new Date().toISOString() : null }).eq('id', recipeId);
  if (error) {
    console.warn('[note] enregistrement impossible :', error.message);
    setLocalRating(recipeId, previous);
    return false;
  }
  return true;
}

// ---------- Signalements et avis ----------

export type ReportReason = 'dangerous' | 'incorrect' | 'bad' | 'translation';
export type FeedbackKind = 'problem' | 'idea' | 'other';
// sent : enregistré ; daily_limit : 20 envois aujourd'hui ; error : réseau ou serveur
export type SendResult = 'sent' | 'daily_limit' | 'error';

async function send(body: Record<string, unknown>): Promise<SendResult> {
  try {
    const { response, data } = await callEdgeFunction('send-feedback', body, 20_000);
    if (response.ok) return 'sent';
    return data?.error === 'daily_limit' ? 'daily_limit' : 'error';
  } catch (error) {
    console.warn('[avis] envoi impossible :', error);
    return 'error';
  }
}

export function sendRecipeReport(recipeId: string, reason: ReportReason, comment: string, language: string): Promise<SendResult> {
  return send({ type: 'recipe_report', recipe_id: recipeId, reason, comment: comment.trim() || undefined, language });
}

// Informations techniques ajoutées à l'avis : version de l'app et numéro du build de test (« 1.0, test 3 »), modèle du téléphone, système, langue (rien d'autre)
export function technicalInfo(language: string) {
  const constants = (Platform.constants ?? {}) as { Brand?: string; Manufacturer?: string; Model?: string };
  const device = [constants.Brand ?? constants.Manufacturer, constants.Model].filter(Boolean).join(' ') || Platform.OS;
  return {
    app_version: technicalVersion(buildInfo),
    device,
    os: `${Platform.OS} ${String(Platform.Version)}`,
    language,
  };
}

export function sendAppFeedback(kind: FeedbackKind, message: string, language: string): Promise<SendResult> {
  return send({ type: 'feedback', kind, message: message.trim(), ...technicalInfo(language) });
}
