import { databaseDate, parseDatabaseJson, type DatabaseRow } from '../../../db/rowMappers';

export type ContentReconciliationState =
  | 'pending'
  | 'database_committed'
  | 'resolving'
  | 'resolved'
  | 'failed';

export type ContentReconciliationOperation = {
  id: string;
  workspace: string;
  operation: string;
  scope: string;
  node_ids: string[];
  payload: Record<string, unknown>;
  state: ContentReconciliationState;
  attempt_count: number;
  next_attempt_at: Date;
  last_error: string | null;
  created_at: Date;
  updated_at: Date;
  resolved_at: Date | null;
};

export type ContentReconciliationCreate = Omit<
  ContentReconciliationOperation,
  'state' | 'attempt_count' | 'last_error' | 'updated_at' | 'resolved_at'
> & {
  updated_at?: Date;
};

export type ContentReconciliationUpdate = {
  state?: ContentReconciliationState;
  payload?: Record<string, unknown>;
  attempt_count?: number;
  next_attempt_at?: Date;
  last_error?: string | null;
  updated_at: Date;
  resolved_at?: Date | null;
};

export type ContentReconciliationSummary = {
  pending: number;
  database_committed: number;
  resolving: number;
  failed: number;
  oldest_unresolved_at: Date | null;
};

export type ContentReconciliationDatabase = {
  createOperation(input: ContentReconciliationCreate): Promise<ContentReconciliationOperation>;
  getOperation(id: string): Promise<ContentReconciliationOperation | null>;
  listDueOperations(
    workspace: string,
    now: Date,
    limit: number
  ): Promise<ContentReconciliationOperation[]>;
  updateOperation(
    id: string,
    update: ContentReconciliationUpdate
  ): Promise<ContentReconciliationOperation | null>;
  summarize(workspace: string): Promise<ContentReconciliationSummary>;
};

export const contentReconciliationMapper = (row: DatabaseRow): ContentReconciliationOperation => ({
  id: String(row['id']),
  workspace: String(row['workspace']),
  operation: String(row['operation']),
  scope: String(row['scope']),
  node_ids: parseDatabaseJson<string[]>(row['node_ids'], [], 'content_reconciliation.node_ids'),
  payload: parseDatabaseJson<Record<string, unknown>>(
    row['payload'],
    {},
    'content_reconciliation.payload'
  ),
  state: String(row['state']) as ContentReconciliationState,
  attempt_count: Number(row['attempt_count'] ?? 0),
  next_attempt_at: databaseDate(row['next_attempt_at']),
  last_error: row['last_error'] == null ? null : String(row['last_error']),
  created_at: databaseDate(row['created_at']),
  updated_at: databaseDate(row['updated_at']),
  resolved_at: row['resolved_at'] == null ? null : databaseDate(row['resolved_at'])
});
