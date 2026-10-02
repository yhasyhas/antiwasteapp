// Découpage des cuisines décidé en phase 9 (docs/cuisines-proposition.md) : familles, régions, « Autre cuisine… ».
// Préparé sur phase-9, utilisé seulement par la copie d'évaluation et la version candidate v4 du prompt ; l'app
// garde ses 7 choix jusqu'à la validation de la phase 8 et de la bibliothèque.

export type Language = 'fr' | 'en' | 'es';
type Labels = Record<Language, string>;

export interface CuisineRegion {
  id: string;
  labels: Labels;
  // Libellé pour le prompt (en français, avec les pays)
  prompt: string;
}

export interface CuisineFamily {
  id: string;
  labels: Labels;
  regions: string[];
  prompt: string;
}

export const REGION_CHOICES: CuisineRegion[] = [
  { id: 'afrique-ouest', labels: { fr: "Afrique de l'Ouest", en: 'West Africa', es: 'África occidental' }, prompt: "cuisines d'Afrique de l'Ouest (Sénégal, Mali, Guinée, Côte d'Ivoire, Ghana, Nigeria, Bénin, Togo…)" },
  { id: 'afrique-centrale', labels: { fr: 'Afrique centrale', en: 'Central Africa', es: 'África central' }, prompt: "cuisines d'Afrique centrale (Cameroun, Gabon, Congo, RDC, Centrafrique, Tchad…)" },
  { id: 'afrique-est', labels: { fr: "Afrique de l'Est", en: 'East Africa', es: 'África oriental' }, prompt: "cuisines d'Afrique de l'Est (Éthiopie, Érythrée, Somalie, Kenya, Tanzanie, Ouganda, Rwanda…)" },
  { id: 'afrique-australe', labels: { fr: 'Afrique australe', en: 'Southern Africa', es: 'África austral' }, prompt: "cuisines d'Afrique australe (Afrique du Sud, Zimbabwe, Mozambique, Angola, Zambie…)" },
  { id: 'ocean-indien', labels: { fr: 'Océan Indien', en: 'Indian Ocean islands', es: 'Islas del océano Índico' }, prompt: "cuisines de l'océan Indien (Madagascar, Maurice, La Réunion, Comores, Mayotte)" },
  { id: 'maghreb', labels: { fr: 'Afrique du Nord (Maghreb)', en: 'North Africa (Maghreb)', es: 'Norte de África (Magreb)' }, prompt: 'cuisine du Maghreb (Maroc, Algérie, Tunisie, Libye)' },
  { id: 'asie-est', labels: { fr: "Asie de l'Est", en: 'East Asia', es: 'Asia oriental' }, prompt: "cuisines d'Asie de l'Est (Chine, Japon, Corée, Taïwan)" },
  { id: 'asie-sud-est', labels: { fr: 'Asie du Sud-Est', en: 'Southeast Asia', es: 'Sudeste asiático' }, prompt: "cuisines d'Asie du Sud-Est (Thaïlande, Vietnam, Cambodge, Indonésie, Malaisie, Philippines…)" },
  { id: 'asie-sud', labels: { fr: 'Inde et Asie du Sud', en: 'India and South Asia', es: 'India y Asia del Sur' }, prompt: "cuisines d'Inde et d'Asie du Sud (Inde, Pakistan, Bangladesh, Sri Lanka, Népal)" },
  { id: 'mexique-amerique-centrale', labels: { fr: 'Mexique et Amérique centrale', en: 'Mexico and Central America', es: 'México y Centroamérica' }, prompt: "cuisines du Mexique et d'Amérique centrale" },
  { id: 'caraibes', labels: { fr: 'Caraïbes', en: 'Caribbean', es: 'Caribe' }, prompt: 'cuisines des Caraïbes (Guadeloupe, Martinique, Haïti, Cuba, République dominicaine, Jamaïque…)' },
  { id: 'amerique-sud', labels: { fr: 'Amérique du Sud', en: 'South America', es: 'Sudamérica' }, prompt: "cuisines d'Amérique du Sud (Pérou, Colombie, Venezuela, Brésil, Argentine, Chili…)" },
  { id: 'europe-sud', labels: { fr: 'Europe du Sud', en: 'Southern Europe', es: 'Europa del Sur' }, prompt: "cuisines d'Europe du Sud (Italie, Espagne, Portugal, Grèce)" },
  { id: 'levant-turquie', labels: { fr: 'Proche-Orient et Turquie', en: 'Middle East and Turkey', es: 'Oriente Próximo y Turquía' }, prompt: 'cuisines du Proche-Orient et de Turquie (Liban, Syrie, Palestine, Turquie, Égypte…)' },
  { id: 'france', labels: { fr: 'France', en: 'France', es: 'Francia' }, prompt: 'cuisine française (cuisine du quotidien et des régions)' },
];

// France : choix direct, sans second niveau (pas de famille)
export const FAMILY_CHOICES: CuisineFamily[] = [
  { id: 'africa', labels: { fr: "Toute l'Afrique", en: 'All of Africa', es: 'Toda África' }, regions: ['afrique-ouest', 'afrique-centrale', 'afrique-est', 'afrique-australe', 'ocean-indien', 'maghreb'], prompt: "cuisines d'Afrique (Afrique de l'Ouest, centrale, de l'Est, australe, océan Indien, Afrique du Nord)" },
  { id: 'asia', labels: { fr: "Toute l'Asie", en: 'All of Asia', es: 'Toda Asia' }, regions: ['asie-est', 'asie-sud-est', 'asie-sud'], prompt: "cuisines d'Asie (Asie de l'Est, Asie du Sud-Est, Inde et Asie du Sud)" },
  { id: 'americas', labels: { fr: 'Toutes les Amériques', en: 'All of the Americas', es: 'Todas las Américas' }, regions: ['mexique-amerique-centrale', 'caraibes', 'amerique-sud'], prompt: "cuisines d'Amérique latine et des Caraïbes (Mexique et Amérique centrale, Caraïbes, Amérique du Sud)" },
  { id: 'mediterranean', labels: { fr: 'Toute la Méditerranée', en: 'All of the Mediterranean', es: 'Todo el Mediterráneo' }, regions: ['europe-sud', 'levant-turquie'], prompt: 'cuisines méditerranéennes (Europe du Sud, Proche-Orient et Turquie)' },
];

// Valeurs enregistrées aujourd'hui dans les préférences : elles restent valides
export const LEGACY_CUISINES: Record<string, string> = {
  african: 'africa',
  maghreb: 'maghreb',
  asian: 'asia',
  latin: 'americas',
  mediterranean: 'mediterranean',
  french: 'france',
};

export const OTHER_CUISINE = 'other';
export const OTHER_MAX_LENGTH = 40;

// « Autre cuisine… » : texte libre court, réduit aux lettres, espaces, traits d'union et apostrophes (il va dans
// le prompt : ni consigne ni ponctuation), ou null s'il ne reste rien d'utilisable
export function cleanOtherCuisine(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.normalize('NFC').replace(/[^\p{L}\s'’-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, OTHER_MAX_LENGTH).trim();
  return text.length >= 2 ? text : null;
}

export type ResolvedCuisine =
  | { kind: 'any' }
  | { kind: 'regions'; id: string; regions: string[]; prompt: string }
  | { kind: 'other'; text: string };

// Choix envoyé par l'app (ancienne valeur, famille, région ou « Autre ») : régions de la bibliothèque et libellé
export function resolveCuisine(value: unknown, other?: unknown): ResolvedCuisine {
  if (value === OTHER_CUISINE) {
    const text = cleanOtherCuisine(other);
    return text ? { kind: 'other', text } : { kind: 'any' };
  }
  if (typeof value !== 'string') return { kind: 'any' };
  const id = LEGACY_CUISINES[value] ?? value;
  const region = REGION_CHOICES.find((r) => r.id === id);
  if (region) return { kind: 'regions', id, regions: [id], prompt: region.prompt };
  const family = FAMILY_CHOICES.find((f) => f.id === id);
  if (family) return { kind: 'regions', id, regions: family.regions, prompt: family.prompt };
  return { kind: 'any' };
}
