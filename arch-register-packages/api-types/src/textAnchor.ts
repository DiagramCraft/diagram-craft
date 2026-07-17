const DEFAULT_CONTEXT_LENGTH = 32;
const SEARCH_WINDOW = 500;
const MIN_FUZZY_CONFIDENCE = 0.6;

export type TextAnchor = {
  quote: string;
  prefix: string;
  suffix: string;
  start: number;
  end: number;
};

export type ReanchorResult =
  | { status: 'exact'; start: number; end: number }
  | { status: 'fuzzy'; start: number; end: number; confidence: number }
  | { status: 'orphaned' };

export const createTextAnchor = (
  body: string,
  start: number,
  end: number,
  contextLength = DEFAULT_CONTEXT_LENGTH
): TextAnchor => ({
  quote: body.slice(start, end),
  prefix: body.slice(Math.max(0, start - contextLength), start),
  suffix: body.slice(end, end + contextLength),
  start,
  end
});

const findAllOccurrences = (body: string, quote: string): number[] => {
  if (quote === '') return [];
  const positions: number[] = [];
  let from = 0;
  for (;;) {
    const idx = body.indexOf(quote, from);
    if (idx === -1) break;
    positions.push(idx);
    from = idx + 1;
  }
  return positions;
};

const contextScore = (body: string, start: number, end: number, anchor: TextAnchor): number => {
  const prefix = body.slice(Math.max(0, start - anchor.prefix.length), start);
  const suffix = body.slice(end, end + anchor.suffix.length);
  return similarity(prefix, anchor.prefix) + similarity(suffix, anchor.suffix);
};

const pickBestByContext = (
  body: string,
  candidates: number[],
  anchor: TextAnchor,
  preferredOffset: number
): number => {
  let best = candidates[0]!;
  let bestScore = -Infinity;
  for (const start of candidates) {
    const end = start + anchor.quote.length;
    const score =
      contextScore(body, start, end, anchor) - Math.abs(start - preferredOffset) / body.length;
    if (score > bestScore) {
      bestScore = score;
      best = start;
    }
  }
  return best;
};

// Normalized similarity in [0, 1] based on Levenshtein edit distance.
const similarity = (a: string, b: string): number => {
  if (a === '' && b === '') return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
};

const levenshtein = (a: string, b: string): number => {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1]! + 1, prev[j]! + 1, prev[j - 1]! + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n]!;
};

// Best-effort approximate search for `anchor.quote` inside `window`, scanning candidate
// windows of the same length and scoring by combined quote/prefix/suffix similarity.
const fuzzyFind = (
  body: string,
  anchor: TextAnchor,
  searchStart: number,
  searchEnd: number
): { start: number; end: number; confidence: number } | undefined => {
  const quoteLen = anchor.quote.length;
  if (quoteLen === 0) return undefined;

  const from = Math.max(0, searchStart);
  const to = Math.min(body.length, searchEnd);

  let best: { start: number; end: number; confidence: number } | undefined;
  const step = Math.max(1, Math.floor(quoteLen / 4));
  for (let start = from; start + quoteLen <= to; start += step) {
    const end = start + quoteLen;
    const quoteSim = similarity(body.slice(start, end), anchor.quote);
    const prefix = body.slice(Math.max(0, start - anchor.prefix.length), start);
    const suffix = body.slice(end, end + anchor.suffix.length);
    const prefixSim = similarity(prefix, anchor.prefix);
    const suffixSim = similarity(suffix, anchor.suffix);
    const confidence = quoteSim * 0.6 + prefixSim * 0.2 + suffixSim * 0.2;
    if (!best || confidence > best.confidence) {
      best = { start, end, confidence };
    }
  }
  return best;
};

export const reanchorText = (body: string, anchor: TextAnchor): ReanchorResult => {
  if (
    anchor.start >= 0 &&
    anchor.end <= body.length &&
    body.slice(anchor.start, anchor.end) === anchor.quote
  ) {
    return { status: 'exact', start: anchor.start, end: anchor.end };
  }

  const occurrences = findAllOccurrences(body, anchor.quote);
  if (occurrences.length === 1) {
    const start = occurrences[0]!;
    return { status: 'exact', start, end: start + anchor.quote.length };
  }
  if (occurrences.length > 1) {
    const start = pickBestByContext(body, occurrences, anchor, anchor.start);
    return { status: 'exact', start, end: start + anchor.quote.length };
  }

  const windowStart = Math.max(0, anchor.start - SEARCH_WINDOW);
  const windowEnd = Math.min(body.length, anchor.end + SEARCH_WINDOW);
  const windowed = fuzzyFind(body, anchor, windowStart, windowEnd);
  const fullDoc =
    windowed && windowed.confidence >= MIN_FUZZY_CONFIDENCE
      ? windowed
      : fuzzyFind(body, anchor, 0, body.length);

  if (fullDoc && fullDoc.confidence >= MIN_FUZZY_CONFIDENCE) {
    return {
      status: 'fuzzy',
      start: fullDoc.start,
      end: fullDoc.end,
      confidence: fullDoc.confidence
    };
  }

  return { status: 'orphaned' };
};

export const isTextAnchorStale = (body: string, anchor: TextAnchor): boolean =>
  reanchorText(body, anchor).status === 'orphaned';
