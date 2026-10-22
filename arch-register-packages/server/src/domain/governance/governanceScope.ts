import type { DatabaseAdapter } from '../../db/database';
import type { GovernanceCaseConfigDbUpsert } from './db/governanceCaseConfigDatabase';

/**
 * Upserts a scoped workflow config, taking over its subkinds from any other config of the same
 * case kind that currently covers them (those configs shrink, or are deleted when left empty).
 * Reuses the config covering the first subkind, so re-applying an import updates in place. Used
 * where a scope is applied wholesale (import) rather than through the overlap-rejecting API.
 */
export const upsertGovernanceConfigClaimingScope = async (
  db: DatabaseAdapter,
  input: Omit<GovernanceCaseConfigDbUpsert, 'id'>
) => {
  const store = db.governanceCaseConfig;
  const subkinds = [...new Set(input.case_subkinds)];
  const target =
    subkinds[0] != null
      ? await store.getCaseConfig(input.workspace, input.case_kind, subkinds[0])
      : null;

  for (const subkind of subkinds) {
    const other = await store.getCaseConfig(input.workspace, input.case_kind, subkind);
    if (!other || other.id === target?.id) continue;
    const remaining = other.case_subkinds.filter(candidate => !subkinds.includes(candidate));
    if (remaining.length === 0) {
      await store.deleteCaseConfig(input.workspace, other.id);
    } else {
      await store.upsertCaseConfig({
        id: other.id,
        workspace: other.workspace,
        case_kind: other.case_kind,
        case_subkinds: remaining,
        name: other.name,
        description: other.description,
        enabled: other.enabled,
        config: other.config,
        updated_at: input.updated_at,
        updated_by: input.updated_by
      });
    }
  }

  return store.upsertCaseConfig({ ...input, case_subkinds: subkinds, id: target?.id });
};
