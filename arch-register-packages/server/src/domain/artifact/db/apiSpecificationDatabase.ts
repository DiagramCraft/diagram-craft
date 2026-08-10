import { databaseDate, type DatabaseRow } from '../../../db/rowMappers';
import type {
  ApiSpecificationDiagnosticCategory,
  ApiSpecificationDiagnosticSeverity,
  ApiSpecificationItemKind,
  ApiSpecificationProtocol
} from '@arch-register/api-types/artifactContract';

export type ApiSpecificationDiagnosticDb = {
  id: string;
  severity: ApiSpecificationDiagnosticSeverity;
  category: ApiSpecificationDiagnosticCategory;
  code: string;
  message: string;
  source_pointer: string | null;
  source_line: number | null;
  source_column: number | null;
  sort_order: number;
};

export type ApiSpecificationItemDbResult = {
  id: string;
  workspace: string;
  artifact_revision_id: string;
  item_key: string;
  protocol: ApiSpecificationProtocol;
  item_kind: ApiSpecificationItemKind;
  path: string | null;
  channel: string | null;
  action: string;
  identifier: string;
  declared_identifier: string | null;
  summary: string | null;
  description: string | null;
  tags: string[];
  deprecated: boolean;
  parameters: Record<string, unknown>[];
  input_summary: Record<string, unknown> | null;
  output_summary: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  source_pointer: string;
  source_line: number | null;
  source_column: number | null;
  sort_order: number;
};

export type ApiSpecificationItemDbCreate = Omit<
  ApiSpecificationItemDbResult,
  'workspace' | 'artifact_revision_id'
>;

export type ApiSpecificationRevisionDbResult = {
  workspace: string;
  artifact_revision_id: string;
  protocol: ApiSpecificationProtocol | null;
  specification_version: string | null;
  title: string | null;
  description: string | null;
  status: 'current' | 'invalid' | 'unsupported';
  item_count: number;
  created_at: Date;
  updated_at: Date;
  diagnostics: ApiSpecificationDiagnosticDb[];
};

export type ApiSpecificationRevisionDbCreate = Omit<
  ApiSpecificationRevisionDbResult,
  'diagnostics'
> & {
  diagnostics: ApiSpecificationDiagnosticDb[];
  items: ApiSpecificationItemDbCreate[];
};

export type ApiSpecificationItemFilters = {
  q?: string;
  resource?: string;
  action?: string;
  kind?: ApiSpecificationItemKind;
  tag?: string;
  deprecated?: boolean;
};

export type ApiSpecificationDatabase = {
  getRevision(
    workspace: string,
    artifactRevisionId: string
  ): Promise<ApiSpecificationRevisionDbResult | null>;
  listItems(
    workspace: string,
    artifactRevisionId: string,
    filters: ApiSpecificationItemFilters,
    pagination: { limit: number; offset: number }
  ): Promise<{ items: ApiSpecificationItemDbResult[]; total: number }>;
  replaceRevision(input: ApiSpecificationRevisionDbCreate): Promise<void>;
};

const parseJson = <T>(value: unknown, fallback: T): T => {
  if (typeof value !== 'string') return (value as T | null) ?? fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const integerOrNull = (value: unknown) => (value == null ? null : Number(value));

export const apiSpecificationMappers = {
  item: (row: DatabaseRow, tags: string[] = []): ApiSpecificationItemDbResult => ({
    id: String(row['id']),
    workspace: String(row['workspace']),
    artifact_revision_id: String(row['artifact_revision_id']),
    item_key: String(row['item_key']),
    protocol: String(row['protocol']) as ApiSpecificationProtocol,
    item_kind: String(row['item_kind']) as ApiSpecificationItemKind,
    path: row['path'] == null ? null : String(row['path']),
    channel: row['channel'] == null ? null : String(row['channel']),
    action: String(row['action']),
    identifier: String(row['identifier']),
    declared_identifier:
      row['declared_identifier'] == null ? null : String(row['declared_identifier']),
    summary: row['summary'] == null ? null : String(row['summary']),
    description: row['description'] == null ? null : String(row['description']),
    tags,
    deprecated: row['deprecated'] === true || Number(row['deprecated']) === 1,
    parameters: parseJson<Record<string, unknown>[]>(row['parameters'], []),
    input_summary: parseJson<Record<string, unknown> | null>(row['input_summary'], null),
    output_summary: parseJson<Record<string, unknown> | null>(row['output_summary'], null),
    metadata: parseJson<Record<string, unknown>>(row['metadata'], {}),
    source_pointer: String(row['source_pointer']),
    source_line: integerOrNull(row['source_line']),
    source_column: integerOrNull(row['source_column']),
    sort_order: Number(row['sort_order'])
  }),
  diagnostic: (row: DatabaseRow): ApiSpecificationDiagnosticDb => ({
    id: String(row['id']),
    severity: String(row['severity']) as ApiSpecificationDiagnosticSeverity,
    category: String(row['category']) as ApiSpecificationDiagnosticCategory,
    code: String(row['code']),
    message: String(row['message']),
    source_pointer: row['source_pointer'] == null ? null : String(row['source_pointer']),
    source_line: integerOrNull(row['source_line']),
    source_column: integerOrNull(row['source_column']),
    sort_order: Number(row['sort_order'])
  }),
  revision: (
    row: DatabaseRow,
    diagnostics: ApiSpecificationDiagnosticDb[]
  ): ApiSpecificationRevisionDbResult => ({
    workspace: String(row['workspace']),
    artifact_revision_id: String(row['artifact_revision_id']),
    protocol:
      row['protocol'] == null ? null : (String(row['protocol']) as ApiSpecificationProtocol),
    specification_version:
      row['specification_version'] == null ? null : String(row['specification_version']),
    title: row['title'] == null ? null : String(row['title']),
    description: row['description'] == null ? null : String(row['description']),
    status: String(row['status']) as ApiSpecificationRevisionDbResult['status'],
    item_count: Number(row['item_count']),
    created_at: databaseDate(row['created_at']),
    updated_at: databaseDate(row['updated_at']),
    diagnostics
  })
};
