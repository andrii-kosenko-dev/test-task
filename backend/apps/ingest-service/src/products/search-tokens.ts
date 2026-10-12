const MAX_QUERY_TOKENS = 8;
const MAX_TOKEN_LENGTH = 32;

/** Lowercase, strip accents, replace everything but letters/digits with single spaces. */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function words(text: string): string[] {
  const n = normalize(text);
  return n === '' ? [] : n.split(' ');
}

/** Prefixes of length >= 2, plus the whole word (so one-letter words stay findable). */
export function prefixes(word: string): string[] {
  const capped = word.slice(0, MAX_TOKEN_LENGTH);
  const out: string[] = [];
  for (let i = 2; i <= capped.length; i++) out.push(capped.slice(0, i));
  return out.length === 0 ? [capped] : out;
}

function tokensOf(...texts: (string | undefined)[]): string[] {
  const set = new Set<string>();
  for (const text of texts) for (const w of words(text ?? '')) for (const p of prefixes(w)) set.add(p);
  return [...set];
}

export interface TokenSource {
  readonly title: string;
  readonly brand?: string;
  readonly category: string;
  readonly description: string;
}

export interface Tokens {
  readonly searchTokens: string[];
  readonly titleTokens: string[];
  readonly metaTokens: string[];
}

export function buildTokens(p: TokenSource): Tokens {
  return {
    titleTokens: tokensOf(p.title),
    metaTokens: tokensOf(p.brand, p.category),
    searchTokens: tokensOf(p.title, p.brand, p.category, p.description),
  };
}

export function queryTokens(query: string): string[] {
  return [...new Set(words(query))].slice(0, MAX_QUERY_TOKENS).map((w) => w.slice(0, MAX_TOKEN_LENGTH));
}
