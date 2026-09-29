import type { RecipeText } from '@/components/recipe/types';
import { callEdgeFunction } from './callEdgeFunction';
import { failureReasonOf, type FailureReason } from './quotaReason';

// « Traduire en … » (fonction translate-recipe) : traduction générée une seule fois par recette et par
// langue, puis relue ; traductions déjà reçues gardées en mémoire pendant la session.

export type TranslationResult = { ok: true; translation: RecipeText } | { ok: false; reason: FailureReason };

const cache = new Map<string, RecipeText>();

export const cachedTranslation = (recipeId: string, language: string) => cache.get(`${recipeId}:${language}`);

export async function translateRecipe(recipeId: string, language: string): Promise<TranslationResult> {
  const cached = cachedTranslation(recipeId, language);
  if (cached) return { ok: true, translation: cached };
  try {
    const { response, data } = await callEdgeFunction('translate-recipe', { recipe_id: recipeId, language });
    if (response.ok && data?.translation) {
      cache.set(`${recipeId}:${language}`, data.translation as RecipeText);
      return { ok: true, translation: data.translation as RecipeText };
    }
    return { ok: false, reason: failureReasonOf(data) ?? 'provider_error' };
  } catch (error) {
    console.warn('[traduction] appel impossible', error);
    return { ok: false, reason: 'provider_error' };
  }
}
