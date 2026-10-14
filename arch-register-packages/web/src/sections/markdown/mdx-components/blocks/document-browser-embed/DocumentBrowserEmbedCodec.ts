import {
  decodeConfigAttribute,
  encodeConfigAttribute,
  initialConfigOf,
  parseConfigFields
} from '../../configSchema';
import {
  DOCUMENT_BROWSER_BASE_COLUMN_IDS,
  documentBrowserEmbedConfigSchema,
  type DocumentBrowserEmbedConfig
} from './types';

export const createDefaultDocumentBrowserEmbedConfig = (): DocumentBrowserEmbedConfig =>
  initialConfigOf(documentBrowserEmbedConfigSchema) as DocumentBrowserEmbedConfig;

export const encodeDocumentBrowserEmbedConfig = (config: DocumentBrowserEmbedConfig): string =>
  encodeConfigAttribute(config);

/** Keeps the entries of a stored list that are still valid, e.g. after a column was removed. */
const keepValid = (value: unknown, isValid: (item: unknown) => boolean): unknown =>
  Array.isArray(value) ? value.filter(isValid) : value;

export const decodeDocumentBrowserEmbedConfig = (
  raw: string | undefined
): DocumentBrowserEmbedConfig | null => {
  const payload = decodeConfigAttribute(raw);
  if (!payload) return null;
  return parseConfigFields(
    documentBrowserEmbedConfigSchema,
    {
      ...payload,
      visibleBaseColumnIds: keepValid(payload.visibleBaseColumnIds, item =>
        (DOCUMENT_BROWSER_BASE_COLUMN_IDS as readonly unknown[]).includes(item)
      ),
      visibleFieldIds: keepValid(payload.visibleFieldIds, item => typeof item === 'string')
    },
    createDefaultDocumentBrowserEmbedConfig()
  );
};
