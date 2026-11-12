import type { DatabaseAdapter } from '../../db/database';
import { listAllCatalogEntities } from '../catalog/entityLoader';
import type { RelationDbResult } from '../catalog/db/relationDatabase';
import { buildDraftCatalog } from './draftCatalog';
import { validateRecordsAgainstCatalog } from './draftRecordValidation';

export const SCHEMA_DRAFT_REVIEW_JOB_TYPE = 'schema-draft.review-records';
export const SCHEMA_DRAFT_REVIEW_SYSTEM_IDENTITY = 'schema-draft-review';

const listAllRelations = async (db: DatabaseAdapter, workspace: string, signal: AbortSignal) => {
  const rows: RelationDbResult[] = [];
  const limit = 500;
  for (let offset = 0; !signal.aborted; offset += limit) {
    const page = await db.relation.listRelations(workspace, {}, { limit, offset });
    rows.push(...page.items);
    if (page.items.length < limit) break;
  }
  return rows;
};

/**
 * Validates existing entities and relations against the draft catalog. Strictly read-only; the
 * returned object is stored as the job run result.
 */
export const createSchemaDraftReviewJobHandler =
  (db: DatabaseAdapter) =>
  async (context: {
    workspace: string;
    payload: Record<string, unknown>;
    signal: AbortSignal;
  }): Promise<Record<string, unknown>> => {
    const revision = context.payload['revision'];
    if (typeof revision !== 'number') {
      throw new Error('Schema draft review job has an invalid payload');
    }
    const draft = await db.schemaDraft.getDraft(context.workspace);
    if ((draft?.revision ?? 0) !== revision) {
      return { stale: true, revision };
    }
    const items = await db.schemaDraft.listItems(context.workspace);
    const catalog = await buildDraftCatalog(db, context.workspace, items);
    const [entities, relations] = await Promise.all([
      listAllCatalogEntities(db, context.workspace),
      listAllRelations(db, context.workspace, context.signal)
    ]);
    if (context.signal.aborted) throw new Error('Schema draft review was aborted');
    const result = validateRecordsAgainstCatalog(catalog.live, catalog.draft, entities, relations);
    return { stale: false, revision, ...result };
  };
