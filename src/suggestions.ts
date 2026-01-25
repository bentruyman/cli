/**
 * Calculates the Levenshtein distance between two strings.
 * This represents the minimum number of single-character edits
 * (insertions, deletions, or substitutions) required to change
 * one string into the other.
 */
export function levenshteinDistance(a: string, b: string): number {
  const aLower = a.toLowerCase();
  const bLower = b.toLowerCase();

  if (aLower === bLower) return 0;
  if (aLower.length === 0) return bLower.length;
  if (bLower.length === 0) return aLower.length;

  // Use optimized single-row approach for space efficiency
  // We only need to keep track of the previous row
  let prevRow: number[] = [];
  for (let j = 0; j <= bLower.length; j++) {
    prevRow.push(j);
  }

  for (let i = 1; i <= aLower.length; i++) {
    const currentRow: number[] = [i];
    for (let j = 1; j <= bLower.length; j++) {
      const cost = aLower[i - 1] === bLower[j - 1] ? 0 : 1;
      currentRow.push(
        Math.min(
          (prevRow[j] ?? 0) + 1, // deletion
          (currentRow[j - 1] ?? 0) + 1, // insertion
          (prevRow[j - 1] ?? 0) + cost, // substitution
        ),
      );
    }
    prevRow = currentRow;
  }

  return prevRow[bLower.length] ?? 0;
}

export interface SuggestionResult {
  candidate: string;
  distance: number;
}

/**
 * Finds the best matching suggestions from a list of candidates.
 *
 * @param input - The user's input string (possibly a typo)
 * @param candidates - List of valid options to match against
 * @param maxDistance - Maximum edit distance to consider (default: min(3, 40% of input length))
 * @returns Array of suggestions sorted by distance (closest first), max 3 results
 */
export function findSuggestions(
  input: string,
  candidates: string[],
  maxDistance?: number,
): string[] {
  // Skip suggestions for very short inputs (too many false positives)
  if (input.length < 2) {
    return [];
  }

  // Default threshold: minimum of 3 or 40% of input length
  const threshold = maxDistance ?? Math.min(3, Math.floor(input.length * 0.4) + 1);

  const results: SuggestionResult[] = [];

  for (const candidate of candidates) {
    const distance = levenshteinDistance(input, candidate);
    // Include if within threshold AND (distance > 0 OR strings differ in case)
    // This ensures we suggest "add" when user types "ADD"
    if (distance <= threshold && (distance > 0 || input !== candidate)) {
      results.push({ candidate, distance });
    }
  }

  // Sort by distance (closest first), then alphabetically for ties
  results.sort((a, b) => {
    if (a.distance !== b.distance) {
      return a.distance - b.distance;
    }
    return a.candidate.localeCompare(b.candidate);
  });

  // Return top 3 suggestions
  return results.slice(0, 3).map((r) => r.candidate);
}
