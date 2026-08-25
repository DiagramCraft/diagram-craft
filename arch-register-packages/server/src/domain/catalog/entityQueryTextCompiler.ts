import type { WorkspaceAuthorizationContext } from '@arch-register/permissions';
import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
import {
  TextCompileError,
  type EnumCatalog,
  type TextParseResult
} from './entityQueryTextTypes';
import { parseTextQuery } from './entityQueryTextParser';
import { resolveTextQuery } from './entityQueryTextResolver';
import { printEntityQueryText as printText } from './entityQueryTextPrinter';
import { tokenize } from './entityQueryTextTokenizer';
import type {
  RelationSchemaCatalog,
  SchemaCatalog
} from './entityQueryIRResolution';

// Public façade for the text ⇄ IR compiler. The individual stages are intentionally kept in
// sibling modules so tokenization, parsing, resolution, and printing can be tested independently.

export type { EnumCatalog, TextParseError, TextParseResult } from './entityQueryTextTypes';

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

export const printEntityQueryText = (
  query: EntityQuery,
  schemas: SchemaCatalog,
  relationSchemas: RelationSchemaCatalog = new Map()
): string => printText(query, schemas, relationSchemas);
