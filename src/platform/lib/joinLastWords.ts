/**
 * Ties the last two words of a short phrase with a no-break space, so a figure such as "+$90 a
 * year" wraps as "+$90" over "a year", never leaving "a" alone at the end of a line (#707).
 */
export function joinLastWords(text: string): string {
  return text.replace(/(\S+)\s+(\S+)$/, '$1\u00a0$2')
}
