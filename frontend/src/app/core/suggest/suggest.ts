import type { SearchQuery } from '../../store/queries/queries.reducer';
import { normalize, tokenize } from '../search/tokenize';

export interface TermCount {
  readonly term: string;
  readonly count: number;
}

export interface Suggestion {
  readonly text: string;
  readonly source: 'history' | 'term';
}

export const DEFAULT_SUGGESTION_LIMIT = 8;

/** Distinct words across titles, with the number of titles each appears in. */
export function buildTermIndex(titles: readonly string[]): TermCount[] {
  const counts = new Map<string, number>();
  for (const title of titles) {
    for (const term of new Set(tokenize(title))) {
      if (term.length < 2) continue;
      counts.set(term, (counts.get(term) ?? 0) + 1);
    }
  }
  return [...counts]
    .map(([term, count]) => ({ term, count }))
    .sort((a, b) => b.count - a.count || a.term.localeCompare(b.term));
}

/** Every input token must prefix-match a different word of the candidate. */
function matchesWords(inputTokens: readonly string[], candidateWords: readonly string[]): boolean {
  const free = [...candidateWords];
  return inputTokens.every((token) => {
    const i = free.findIndex((w) => w.startsWith(token));
    if (i === -1) return false;
    free.splice(i, 1);
    return true;
  });
}

function fromHistory(input: string, history: readonly SearchQuery[]): Suggestion[] {
  const inputTokens = tokenize(input);
  const ranked: { query: SearchQuery; rank: number }[] = [];

  for (const query of history) {
    if (query.id === input) continue;
    if (query.id.startsWith(input)) ranked.push({ query, rank: 0 });
    else if (matchesWords(inputTokens, tokenize(query.id))) ranked.push({ query, rank: 1 });
  }

  return ranked
    .sort(
      (a, b) =>
        a.rank - b.rank || b.query.hits - a.query.hits || b.query.lastUsedAt - a.query.lastUsedAt,
    )
    .map(({ query }) => ({ text: query.text, source: 'history' }));
}

function fromTerms(input: string, terms: readonly TermCount[]): Suggestion[] {
  const lastSpace = input.lastIndexOf(' ');
  const lead = input.slice(0, lastSpace + 1);
  const fragment = input.slice(lastSpace + 1);
  if (!fragment) return [];

  return terms
    .filter(({ term }) => term.startsWith(fragment) && lead + term !== input)
    .map(({ term }) => ({ text: lead + term, source: 'term' }));
}

/**
 * Typeahead candidates: past queries first (prefix match, then any-word match),
 * then completions of the last typed word from product-title terms.
 */
export function suggest(params: {
  input: string;
  history: readonly SearchQuery[];
  terms: readonly TermCount[];
  limit?: number;
}): Suggestion[] {
  const { history, terms, limit = DEFAULT_SUGGESTION_LIMIT } = params;
  // Keep the trailing space so "red " completes a new word instead of the previous one.
  const input = normalize(params.input) + (/\s$/.test(params.input) ? ' ' : '');
  if (!input.trim()) return [];

  const seen = new Set<string>();
  const out: Suggestion[] = [];
  for (const s of [...fromHistory(input.trim(), history), ...fromTerms(input, terms)]) {
    if (seen.has(s.text)) continue;
    seen.add(s.text);
    out.push(s);
    if (out.length === limit) break;
  }
  return out;
}
