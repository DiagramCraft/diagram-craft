import { encodeCaseSubkind } from '@arch-register/server/domain/governance/governanceCaseSubkind';
import { ENTITY_CHANGE_POLICY_CASE_KIND } from '@arch-register/server/domain/governance/schemaGovernancePolicy';
import type { DatabaseAdapter } from '@arch-register/server/db/database';

/**
 * Turns the schema's entity-change approval policy off. The bootstrap seed requires approval for
 * Data Entity changes, so tests that edit Data Entities directly (rather than exercising the
 * approval flow) call this first.
 */
export const disableEntityApproval = async (
  db: DatabaseAdapter,
  workspace: string,
  schemaId: string
) => {
  const caseSubkind = encodeCaseSubkind(schemaId);
  const existing = await db.governanceCaseConfig.getCaseConfig(
    workspace,
    ENTITY_CHANGE_POLICY_CASE_KIND,
    caseSubkind
  );
  if (!existing) return;
  await db.governanceCaseConfig.upsertCaseConfig({
    ...existing,
    enabled: false,
    updated_at: new Date(),
    updated_by: null
  });
};
