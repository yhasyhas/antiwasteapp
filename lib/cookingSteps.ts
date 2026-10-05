// Mode cuisine : ce qu'on lit dans le texte d'une étape (français, anglais, espagnol), sans appel réseau.
// - durées (« 15 minutes », « 5 à 7 minutes », « 1 h 30 », « une demi-heure ») : minuteurs proposés, la durée la
//   plus longue pour une fourchette ;
// - température à cœur (« 74 °C à cœur », « internal temperature of 63 °C ») : mise en évidence ;
// - ingrédients nommés dans l'étape : rappelés sous l'étape avec leur quantité.

export interface StepDuration {
  // Durée proposée pour le minuteur, en secondes (la plus longue d'une fourchette)
  seconds: number;
  // Texte trouvé dans l'étape (« 5 à 7 minutes »)
  text: string;
}

const normalize = (text: string) => text.toLowerCase().replace(/œ/g, 'oe').normalize('NFD').replace(/[̀-ͯ]/g, '');

const NUMBER = String.raw`(\d+(?:[.,]\d+)?|une?|an?|one|two|three|four|five|six|ten|un|deux|trois|quatre|cinq|six|dix|quince|diez|dos|tres|cuatro|cinco|seis)`;
const WORDS: Record<string, number> = {
  un: 1, une: 1, a: 1, an: 1, one: 1, uno: 1, una: 1,
  deux: 2, two: 2, dos: 2, trois: 3, three: 3, tres: 3, quatre: 4, four: 4, cuatro: 4,
  cinq: 5, five: 5, cinco: 5, six: 6, seis: 6, dix: 10, ten: 10, diez: 10, quince: 15,
};
const HOURS = String.raw`(?:heures?|hours?|hrs?|horas?|h)`;
const MINUTES = String.raw`(?:minutes?|minutos?|mins?|mn)`;
const SECONDS = String.raw`(?:secondes?|seconds?|segundos?|secs?|s)`;
const RANGE = String.raw`\s*(?:a|à|-|–|to|y|o|ou|or|et|and)\s*`;
const END = String.raw`(?![a-z])`;

const value = (word: string) => (/\d/.test(word) ? Number(word.replace(',', '.')) : WORDS[word] ?? NaN);

const PATTERNS: { regex: RegExp; seconds: (m: RegExpExecArray) => number }[] = [
  // « 1 h 30 », « 1h30 », « 1 heure 30 », « 2 hours 15 minutes »
  { regex: new RegExp(String.raw`(\d+)\s*${HOURS}\s*(?:et\s*|and\s*|y\s*)?(\d{1,2})\s*(?:${MINUTES})?${END}`, 'g'), seconds: (m) => Number(m[1]) * 3600 + Number(m[2]) * 60 },
  // « une demi-heure », « half an hour », « media hora »
  { regex: /(?:une demi[- ]heure|half an hour|media hora)/g, seconds: () => 1800 },
  // « 1 heure et demie », « an hour and a half », « hora y media »
  { regex: new RegExp(String.raw`${NUMBER}\s*${HOURS}\s*(?:et demie?|and a half|y media)`, 'g'), seconds: (m) => (value(m[1]) + 0.5) * 3600 },
  // Fourchettes : « 5 à 7 minutes », « 10-12 min », « 1 to 2 hours »
  { regex: new RegExp(String.raw`${NUMBER}${RANGE}${NUMBER}\s*(${HOURS}|${MINUTES}|${SECONDS})${END}`, 'g'), seconds: (m) => value(m[2]) * unitSeconds(m[3]) },
  // Durée simple : « 15 minutes », « 2 h », « 30 secondes »
  { regex: new RegExp(String.raw`${NUMBER}\s*(${HOURS}|${MINUTES}|${SECONDS})${END}`, 'g'), seconds: (m) => value(m[1]) * unitSeconds(m[2]) },
];

function unitSeconds(unit: string): number {
  if (new RegExp(`^${HOURS}$`).test(unit)) return 3600;
  if (new RegExp(`^${MINUTES}$`).test(unit)) return 60;
  return 1;
}

// Durées d'une étape, dans l'ordre du texte, sans doublon ni chevauchement ; au plus 12 heures
export function stepDurations(step: string): StepDuration[] {
  // Même longueur que l'étape (« œ » remplacé par une seule lettre) : le texte trouvé est repris tel quel
  const text = step.toLowerCase().replace(/œ/g, 'e').normalize('NFD').replace(/[̀-ͯ]/g, '');
  const found: { start: number; end: number; seconds: number }[] = [];
  for (const pattern of PATTERNS) {
    pattern.regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.regex.exec(text))) {
      const start = match.index;
      const end = start + match[0].length;
      // Déjà couvert par une forme plus précise (« 1 h 30 » avant « 30 »)
      if (found.some((item) => start < item.end && end > item.start)) continue;
      // « 180 °C », « 4 personnes » : pas une durée ; « s » seul après un nombre seulement s'il est isolé
      const seconds = Math.round(pattern.seconds(match));
      if (!Number.isFinite(seconds) || seconds < 5 || seconds > 12 * 3600) continue;
      found.push({ start, end, seconds });
    }
  }
  const seen = new Set<number>();
  return found
    .sort((a, b) => a.start - b.start)
    .filter((item) => (seen.has(item.seconds) ? false : (seen.add(item.seconds), true)))
    .map((item) => ({ seconds: item.seconds, text: step.slice(item.start, item.end).trim() }));
}

// Température à cœur nommée dans l'étape (« 74 °C »), ou null
const CORE_WORDS = /(a coeur|au coeur|coeur|interne|internal|core|centre|center|temperatura interna|en el centro|en el interior|al corazon)/;
const CELSIUS = /(\d{2,3})\s*°\s*c\b/g;
export function coreTemperature(step: string): string | null {
  const text = normalize(step);
  CELSIUS.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = CELSIUS.exec(text))) {
    const around = text.slice(Math.max(0, match.index - 60), match.index + match[0].length + 40);
    const degrees = Number(match[1]);
    // Espace insécable : « 74 °C » jamais coupé en fin de ligne
    if (CORE_WORDS.test(around) && degrees >= 50 && degrees <= 100) return `${degrees} °C`;
  }
  return null;
}

// Minuteur affiché : « 7:00 », « 1:05:00 »
export function formatTimer(seconds: number): string {
  const total = Math.max(0, Math.ceil(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const two = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${two(m)}:${two(s)}` : `${m}:${two(s)}`;
}

// Mots d'un nom d'ingrédient qui le désignent dans une étape (« pommes de terre » → pomme, terre)
const STOP = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'en', 'au', 'aux', 'et', 'of', 'the', 'and', 'a', 'el', 'los', 'las', 'con', 'y', 'frais', 'fraiche', 'fresh', 'fresco', 'fresca']);
const stem = (word: string) => word.replace(/(es|s|x)$/, '');
const wordsOf = (text: string) => normalize(text).split(/[^a-z0-9]+/).filter(Boolean);

// Ingrédients de la recette nommés dans l'étape (dans l'ordre de la liste)
export function stepIngredients<T extends { name: string }>(step: string, ingredients: T[]): T[] {
  const stems = new Set(wordsOf(step).map(stem));
  return ingredients.filter((item) => {
    const words = wordsOf(item.name).filter((word) => word.length >= 3 && !STOP.has(word));
    return words.length > 0 && stems.has(stem(words[0])) || words.some((word) => word.length >= 4 && stems.has(stem(word)));
  });
}
