// Titres à ne pas reproposer (history.ts) : sans doublon ni titre vide, dans l'ordre donné, au plus RECENT_TITLES

export const RECENT_TITLES = 30;

export function mergeTitles(...lists: unknown[][]): string[] {
  const titles = lists.flat().filter((title): title is string => typeof title === 'string' && title.trim() !== '');
  return [...new Set(titles.map((title) => title.trim()))].slice(0, RECENT_TITLES);
}
