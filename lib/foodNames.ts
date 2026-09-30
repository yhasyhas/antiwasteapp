import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { activeHouseholdId } from './household';
import { callEdgeFunction } from './callEdgeFunction';
import { notifyPantryChanged } from './pantryEvents';
import { supabase } from './supabase';

// Noms des aliments dans la langue de l'app : un aliment brut (photo, saisie) relié à sa fiche (food_key)
// s'affiche avec le nom de la fiche dans la langue choisie ; sans fiche, avec le nom enregistré. Un produit
// scanné par code-barres garde toujours son nom, avec son nom générique en sous-titre. Première lettre en
// majuscule. Noms des fiches gardés en mémoire.

type Language = 'fr' | 'en' | 'es';
type Names = Partial<Record<Language, string>>;

// food_key → noms (null : pas de fiche prête)
const names = new Map<string, Names | null>();
const loading = new Set<string>();
const listeners = new Set<() => void>();
let version = 0;

const notify = () => {
  version++;
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const capitalizeFirst = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
const capitalize = capitalizeFirst;
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

// Fiche ouverte ou générée (FoodFactSheet) : ses noms sont connus
export function rememberFoodNames(foodKey: string, fact: Record<Language, { name: string }>) {
  names.set(foodKey, { fr: fact.fr?.name, en: fact.en?.name, es: fact.es?.name });
  notify();
}

async function loadNames(keys: string[]) {
  const missing = [...new Set(keys)].filter((key) => !names.has(key) && !loading.has(key));
  if (missing.length === 0) return;
  missing.forEach((key) => loading.add(key));
  const { data, error } = await supabase
    .from('food_facts')
    .select('food_key, fr:content->fr->>name, en:content->en->>name, es:content->es->>name')
    .in('food_key', missing);
  missing.forEach((key) => loading.delete(key));
  if (error) {
    console.warn('[noms] fiches illisibles :', error.message);
    return;
  }
  const rows = (data ?? []) as unknown as ({ food_key: string } & Names)[];
  for (const key of missing) {
    const row = rows.find((item) => item.food_key === key);
    names.set(key, row ? { fr: row.fr, en: row.en, es: row.es } : null);
  }
  notify();
}

interface NamedFood {
  name: string;
  food_key?: string | null;
  kind?: string | null;
  // Produit scanné par code-barres : nom générique d'Open Food Facts, niveau NOVA
  barcode?: string | null;
  generic_name?: string | null;
  nova_group?: number | null;
}

// Produit peu transformé (NOVA 1 ou 2) : relié à la fiche générique de l'aliment
export const hasGenericFact = (item: NamedFood) => !!item.barcode && (item.nova_group === 1 || item.nova_group === 2);

// name : nom affiché (fiche dans la langue de l'app pour un aliment brut, nom du produit pour un code-barres,
// nom enregistré sinon ; les restes gardent leur nom). generic : sous-titre d'un produit (nom générique
// d'Open Food Facts, sinon celui de sa fiche générique), null s'il n'y en a pas ou s'il répète le nom.
export function useFoodNaming(items: NamedFood[] | null | undefined) {
  const { language } = useLanguage();
  const current = useSyncExternalStore(subscribe, () => version);
  const keys = (items ?? []).map((item) => item.food_key).filter((key): key is string => !!key);
  const keyList = [...new Set(keys)].sort().join(',');

  useEffect(() => {
    if (keyList) loadNames(keyList.split(','));
  }, [keyList]);

  const factName = useCallback((item: NamedFood): string | null => {
    if (!item.food_key) return null;
    return names.get(item.food_key)?.[language as Language] ?? null;
  }, [language, current]);

  const name = useCallback((item: NamedFood): string => {
    if (item.barcode || item.kind === 'dish') return capitalize(item.name);
    return capitalize(factName(item) ?? item.name);
  }, [factName]);

  const generic = useCallback((item: NamedFood): string | null => {
    if (!item.barcode) return null;
    const value = item.generic_name || (hasGenericFact(item) ? factName(item) : null);
    return value && !same(value, item.name) ? capitalize(value) : null;
  }, [factName]);

  return { name, generic };
}

export function useFoodNames(items: NamedFood[] | null | undefined): (item: NamedFood) => string {
  return useFoodNaming(items).name;
}

// Aliments du garde-manger pas encore reliés à leur fiche : reliés en arrière-plan (fonction food-fact,
// mode link_only : l'identifiant est enregistré, aucune fiche n'est générée). Un essai par aliment et par
// session ; quelques-uns à la fois.
const attempted = new Set<string>();
let linking: Promise<void> | null = null;
const LINKS_PER_RUN = 8;

export function linkPantryFoodKeys(): Promise<void> {
  if (linking) return linking;
  linking = (async () => {
    try {
      const householdId = await activeHouseholdId();
      if (!householdId) return;
      const { data } = await supabase
        .from('ingredients')
        .select('id, name, barcode, generic_name, nova_group')
        .eq('household_id', householdId)
        .is('food_key', null)
        .eq('kind', 'ingredient')
        .order('created_at', { ascending: false })
        .limit(LINKS_PER_RUN * 3);
      // Produit par code-barres : relié seulement s'il est peu transformé (NOVA 1 ou 2), par son nom générique ;
      // les autres n'ont pas de fiche générique (fiche produit à la place)
      const todo = (data ?? [])
        .filter((row) => !attempted.has(row.id) && (!row.barcode || hasGenericFact(row)))
        .slice(0, LINKS_PER_RUN);
      let linked = 0;
      for (const row of todo) {
        attempted.add(row.id);
        const { response } = await callEdgeFunction('food-fact', { name: row.generic_name || row.name, ingredient_id: row.id, link_only: true });
        if (response.ok) linked++;
        // Limite du jour atteinte : on s'arrête là
        if (response.status === 429) break;
      }
      if (linked > 0) notifyPantryChanged();
    } catch (error) {
      console.warn('[noms] liaison impossible :', error);
    } finally {
      linking = null;
    }
  })();
  return linking;
}
