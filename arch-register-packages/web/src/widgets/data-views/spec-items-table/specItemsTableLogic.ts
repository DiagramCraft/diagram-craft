import type { SpecificationItemRow } from '../../../hooks/useSpecificationItemsFeed';

// Method → chip color: read-like methods read as safe, writes as accent, PATCH/PUT as a caution,
// DELETE as the one destructive method. Anything else (RPC, PUBLISH, SOAP, …) gets no color.
const METHOD_TONE: Record<string, string> = {
  GET: 'var(--cmp-fg-success, #22c55e)',
  QUERY: 'var(--cmp-fg-success, #22c55e)',
  POST: 'var(--accent-fg)',
  MUTATION: 'var(--accent-fg)',
  PATCH: 'var(--cmp-fg-warning, #eab308)',
  PUT: 'var(--cmp-fg-warning, #eab308)',
  DELETE: 'var(--cmp-fg-danger, #ef4444)'
};

export const specItemTone = (action: string): string | undefined =>
  METHOD_TONE[action.toUpperCase()];

export const specItemSortValue = (row: SpecificationItemRow, key: 'method' | 'path'): string =>
  key === 'method' ? row.item.action : (row.item.path ?? row.item.channel ?? '');

export const specItemsEmptyLabel = (deprecatedOnly: boolean): string =>
  deprecatedOnly
    ? 'No deprecated operations match these filters.'
    : 'No operations match these filters.';
