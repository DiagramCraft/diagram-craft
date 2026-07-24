import type { FilterCondition } from '@arch-register/api-types/viewContract';
import {
  DOCUMENT_BROWSER_BASE_COLUMN_IDS,
  type DocumentBrowserBaseColumnId,
  type DocumentBrowserEmbedConfig
} from './types';

const DEFAULT_CONFIG: DocumentBrowserEmbedConfig = {
  q: '',
  conditions: [],
  sort: 'updated_at',
  sortDir: 'desc',
  visibleBaseColumnIds: [...DOCUMENT_BROWSER_BASE_COLUMN_IDS],
  visibleFieldIds: []
};

const toBase64Url = (input: string): string => {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  bytes.forEach(byte => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (input: string): string => {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

export const encodeDocumentBrowserEmbedConfig = (config: DocumentBrowserEmbedConfig): string =>
  toBase64Url(
    JSON.stringify({
      q: config.q,
      documentTypeId: config.documentTypeId,
      conditions: config.conditions,
      sort: config.sort,
      sortDir: config.sortDir,
      visibleBaseColumnIds: config.visibleBaseColumnIds,
      visibleFieldIds: config.visibleFieldIds
    })
  );

export const decodeDocumentBrowserEmbedConfig = (
  raw: string | undefined
): DocumentBrowserEmbedConfig | null => {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(fromBase64Url(raw)) as Record<string, unknown>;
    if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

    const conditions = Array.isArray(parsed.conditions)
      ? (parsed.conditions as FilterCondition[])
      : [];
    const visibleFieldIds = Array.isArray(parsed.visibleFieldIds)
      ? parsed.visibleFieldIds.filter((value): value is string => typeof value === 'string')
      : [];
    const visibleBaseColumnIds = Array.isArray(parsed.visibleBaseColumnIds)
      ? parsed.visibleBaseColumnIds.filter(
          (value): value is DocumentBrowserBaseColumnId =>
            typeof value === 'string' &&
            (DOCUMENT_BROWSER_BASE_COLUMN_IDS as readonly string[]).includes(value)
        )
      : [...DOCUMENT_BROWSER_BASE_COLUMN_IDS];

    return {
      ...DEFAULT_CONFIG,
      q: typeof parsed.q === 'string' ? parsed.q : '',
      documentTypeId:
        typeof parsed.documentTypeId === 'string' && parsed.documentTypeId !== ''
          ? parsed.documentTypeId
          : undefined,
      conditions,
      sort: typeof parsed.sort === 'string' && parsed.sort !== '' ? parsed.sort : 'updated_at',
      sortDir: parsed.sortDir === 'asc' ? 'asc' : 'desc',
      visibleBaseColumnIds,
      visibleFieldIds
    };
  } catch {
    return null;
  }
};
