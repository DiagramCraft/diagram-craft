import { createBlobConfigCodec } from '../../configSchema';
import { DOCUMENT_BROWSER_BASE_COLUMN_IDS, documentBrowserEmbedConfigSchema } from './types';

/** Keeps the entries of a stored list that are still valid, e.g. after a column was removed. */
const keepValid = (value: unknown, isValid: (item: unknown) => boolean): unknown =>
  Array.isArray(value) ? value.filter(isValid) : value;

export const documentBrowserEmbedCodec = createBlobConfigCodec(documentBrowserEmbedConfigSchema, {
  preDecode: payload => ({
    ...payload,
    visibleBaseColumnIds: keepValid(payload.visibleBaseColumnIds, item =>
      (DOCUMENT_BROWSER_BASE_COLUMN_IDS as readonly unknown[]).includes(item)
    ),
    visibleFieldIds: keepValid(payload.visibleFieldIds, item => typeof item === 'string')
  })
});

export const {
  createDefault: createDefaultDocumentBrowserEmbedConfig,
  encode: encodeDocumentBrowserEmbedConfig,
  decode: decodeDocumentBrowserEmbedConfig
} = documentBrowserEmbedCodec;
