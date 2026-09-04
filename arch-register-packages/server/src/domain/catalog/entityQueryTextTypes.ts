import type { EntityQuery, FilterOp } from '@arch-register/api-types/entityQueryIR';
import type { RelationSchemaCatalog, SchemaCatalog } from './entityQueryIRResolution';
import type { WorkspaceEnumDbResult } from './db/catalogDatabase';

export type EnumCatalog = Map<string, WorkspaceEnumDbResult>;

export type TextParseError = { offset: number; message: string };

export type TextParseResult =
  | { ok: true; query: EntityQuery }
  | { ok: false; errors: TextParseError[] };

export class TextCompileError extends Error {
  constructor(
    message: string,
    readonly offset: number
  ) {
    super(message);
  }
}

export type TokenKind =
  | 'LPAREN'
  | 'RPAREN'
  | 'LBRACKET'
  | 'RBRACKET'
  | 'DOT'
  | 'COMMA'
  | 'ARROW'
  | 'AND'
  | 'OR'
  | 'NOT'
  | 'COMPARATOR'
  | 'STRING'
  | 'NUMBER'
  | 'IDENT'
  | 'EOF';

export type Token = {
  kind: TokenKind;
  text: string;
  value?: string | number;
  offset: number;
};

export type TextNameRef = {
  value: string;
  offset: number;
};

export type TextValue =
  | { kind: 'literal'; value: string | number; offset: number }
  | { kind: 'date'; value: string; offset: number }
  | { kind: 'enumValue'; value: string; offset: number }
  | { kind: 'enumLabel'; value: string; offset: number }
  | { kind: 'empty'; offset: number }
  | { kind: 'notEmpty'; offset: number }
  // A relative-date literal (#3090's `{ $now: true, offsetDays? }`) — `now()` or `now(N)`, valid
  // only against a date field's before/after/on comparison, printed/parsed symmetrically with
  // `date(...)` so a saved view built around it round-trips through Advanced mode.
  | { kind: 'now'; offsetDays?: number; offset: number };

export type TextComparator = {
  text: string;
  offset: number;
};

// One entry of a `columns` sub-clause inside a segment's `[...]` scope (§4.6). `steps` is a
// `capture_path` — a dotted path with no scoped filters — evaluated relative to the record the
// enclosing segment traversed to. `includePath` projects the whole traversed path instead of a
// terminal scalar.
export type TextCapture = {
  includePath: boolean;
  steps: TextPathStep[];
  alias?: string;
  aliasOffset?: number;
  offset: number;
};

export type TextPathStep =
  | {
      kind: 'field';
      field: TextNameRef;
      filter?: TextQueryNode;
      captures?: TextCapture[];
      offset: number;
    }
  | {
      kind: 'backward';
      field: TextNameRef;
      schemaRef?: TextNameRef;
      filter?: TextQueryNode;
      captures?: TextCapture[];
      offset: number;
    }
  | {
      kind: 'typedRelation';
      direction: 'in' | 'out';
      relationRef: TextNameRef;
      filter?: TextQueryNode;
      captures?: TextCapture[];
      offset: number;
    };

export type TextQueryNode =
  | { kind: 'and'; children: TextQueryNode[] }
  | { kind: 'or'; children: TextQueryNode[] }
  | { kind: 'not'; child: TextQueryNode }
  | { kind: 'freeText'; value: string; offset: number; valueOffset: number }
  | { kind: 'schema'; schemaRef: TextNameRef; offset: number }
  | {
      kind: 'path';
      steps: TextPathStep[];
      comparator?: TextComparator;
      value?: TextValue;
      endOffset: number;
    };

export type TextQuerySyntax = {
  root: TextQueryNode;
  topLevelSchemaRefs: TextNameRef[];
};

export type TextResolverContext = {
  schemas: SchemaCatalog;
  enums: EnumCatalog;
  authCtx: import('@arch-register/permissions').WorkspaceAuthorizationContext | null;
  relationSchemas: RelationSchemaCatalog;
};

export type ResolvedComparator = { op: FilterOp; value: unknown };
