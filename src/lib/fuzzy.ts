/** Case-insensitive subsequence score: null = no match; higher = better.
 *  Word-start and contiguous matches score above scattered ones, and a mild
 *  length penalty favors tighter candidates. */
export function fuzzyScore(query: string, candidate: string): number | null {
  const q = query.toLowerCase();
  const c = candidate.toLowerCase();
  if (q.length === 0) return 0;
  let qi = 0;
  let score = 0;
  let prevMatch = -2;
  for (let ci = 0; ci < c.length && qi < q.length; ci++) {
    if (c[ci] !== q[qi]) continue;
    let bonus = 1;
    if (ci === 0 || c[ci - 1] === " ") bonus += 2; // word start
    if (ci === prevMatch + 1) bonus += 2; // contiguous run
    score += bonus;
    prevMatch = ci;
    qi++;
  }
  if (qi < q.length) return null;
  return score - Math.floor((c.length - q.length) / 8);
}

/** Rank candidates against the query. Empty query → the head of the list
 *  unchanged (callers pass recency-ordered candidates); ties keep input
 *  order, so recency is the tiebreak. */
export function fuzzyFilter(query: string, candidates: string[], limit = 6): string[] {
  const trimmed = query.trim();
  if (trimmed === "") return candidates.slice(0, limit);
  return candidates
    .map((value, index) => ({ value, index, score: fuzzyScore(trimmed, value) }))
    .filter((m): m is { value: string; index: number; score: number } => m.score !== null)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map((m) => m.value);
}
