import type { WorkspaceAuthorizationContext } from '@arch-register/permissions';
import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
import { TextCompileError, type EnumCatalog, type TextParseResult } from './entityQueryTextTypes';
import { parseTextQuery } from './entityQueryTextParser';
import { resolveTextQuery } from './entityQueryTextResolver';
import {
  printEntityQueryText as printText,
  type EntityQueryTextPrintOptions
} from './entityQueryTextPrinter';
import { tokenize } from './entityQueryTextTokenizer';
import type { RelationSchemaCatalog, SchemaCatalog } from './entityQueryIRResolution';
import { validateEntityQueryIR } from './entityQueryIRValidator';

// Public façade for the text ⇄ IR compiler. The individual stages are intentionally kept in
// sibling modules so tokenization, parsing, resolution, and printing can be tested independently.

export type { EnumCatalog, TextParseError, TextParseResult } from './entityQueryTextTypes';
export type { EntityQueryTextPrintOptions } from './entityQueryTextPrinter';

export const parseEntityQueryText = (
  text: string,
  schemas: SchemaCatalog,
  enums: EnumCatalog,
  authCtx: WorkspaceAuthorizationContext | null = null,
  relationSchemas: RelationSchemaCatalog = new Map()
): TextParseResult => {
  try {
    const syntax = parseTextQuery(tokenize(text));
    const query = resolveTextQuery(syntax, { schemas, enums, authCtx, relationSchemas });
    return { ok: true, query };
  } catch (error) {
    if (error instanceof TextCompileError) {
      return { ok: false, errors: [{ offset: error.offset, message: error.message }] };
    }
    throw error;
  }
};

/**
 * Parses text and applies the same IR validation used by the public parse endpoint. Keeping this
 * as one façade ensures server-side configuration validation cannot drift from drawer rendering.
 */
export const parseAndValidateEntityQueryText = (
  text: string,
  schemas: SchemaCatalog,
  enums: EnumCatalog,
  authCtx: WorkspaceAuthorizationContext | null = null,
  relationSchemas: RelationSchemaCatalog = new Map()
): TextParseResult => {
  const result = parseEntityQueryText(text, schemas, enums, authCtx, relationSchemas);
  if (!result.ok) return result;
  const validation = validateEntityQueryIR(result.query, schemas, authCtx, relationSchemas);
  if (!validation.ok) {
    return {
      ok: false,
      errors: validation.errors.map(error => ({
        offset: 0,
        message: `${error.path.join('.')}: ${error.message}`
      }))
    };
  }
  return result;
};

export const printEntityQueryText = (
  query: EntityQuery,
  schemas: SchemaCatalog,
  relationSchemas: RelationSchemaCatalog = new Map(),
  options: EntityQueryTextPrintOptions = {}
): string => printText(query, schemas, relationSchemas, options);
