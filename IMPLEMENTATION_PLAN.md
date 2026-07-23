# Implementation Plan: Rename Entity Change Approval DB Layer

## Context

Issue #2341 renamed the public `entityChangeContract` API from "proposal"/"revision" to "change approval" vocabulary, but left the internal DB layer code as-is. This task completes the vocabulary migration by mechanically renaming internal types, variables, and function parameters in the DB layer and operations files.

**Important terminology distinctions:**
- **Database tables** use "entity_change_case" terminology (the new model from migration 063)
- **Old database tables** used "entity_change_proposal" (removed in migration 064)
- **Public API** uses "EntityChangeApproval" terminology (renamed in #2341)
- **Internal DB layer code** still uses "Proposal/Revision" type names (this task renames them to "Approval/ApprovalRevision")

The database schema is correct and does NOT change. We're only renaming the TypeScript types, interfaces, and variables that interact with the database to align with the public API's "approval" terminology.

**Scope:** Internal code only - no database schema changes, no public API changes, no behavior changes.

## Files to Modify

1. `arch-register-packages/server/src/domain/catalog/db/entityChangeDatabase.ts` (~160 lines)
2. `arch-register-packages/server/src/domain/catalog/entityChangeOperations.ts` (~1200+ lines)
3. `arch-register-packages/server/src/db/contract-tests/entityChange.contract.test.ts` (~100 lines)

## Naming Convention Mapping

### Type Names

| Current Name | New Name | Notes |
|--------------|----------|-------|
| `EntityChangeProposalStatus` | `EntityChangeApprovalStatus` | Enum type |
| `EntityChangeRevisionStatus` | `EntityChangeApprovalRevisionStatus` | Enum type |
| `EntityChangeProposalDbResult` | `EntityChangeApprovalDbResult` | DB result type |
| `EntityChangeRevisionDbResult` | `EntityChangeApprovalRevisionDbResult` | DB result type |
| `EntityChangeProposalDbCreate` | `EntityChangeApprovalDbCreate` | DB input type |
| `EntityChangeRevisionDbCreate` | `EntityChangeApprovalRevisionDbCreate` | DB input type |
| `EntityChangeRevisionMemberInput` | `EntityChangeApprovalRevisionMemberInput` | Bulk revision member |
| `EntityChangeBulkRevisionDbCreate` | `EntityChangeBulkApprovalRevisionDbCreate` | Bulk revision input |
| `EntityChangeRevisionMemberDbResult` | `EntityChangeApprovalRevisionMemberDbResult` | Bulk revision member result |

### Interface Method Names

| Current Name | New Name | Notes |
|--------------|----------|-------|
| `createProposal` | `createApproval` | EntityChangeDatabase interface |
| `getProposal` | `getApproval` | EntityChangeDatabase interface |
| `getOpenProposal` | `getOpenApproval` | EntityChangeDatabase interface |
| `listProposals` | `listApprovals` | EntityChangeDatabase interface |
| `updateProposalStatus` | `updateApprovalStatus` | EntityChangeDatabase interface |
| `createRevision` | `createApprovalRevision` | EntityChangeDatabase interface |
| `getRevision` | `getApprovalRevision` | EntityChangeDatabase interface |
| `getLatestRevision` | `getLatestApprovalRevision` | EntityChangeDatabase interface |
| `listRevisions` | `listApprovalRevisions` | EntityChangeDatabase interface |
| `updateRevisionStatus` | `updateApprovalRevisionStatus` | EntityChangeDatabase interface |
| `createBulkRevision` | `createBulkApprovalRevision` | EntityChangeDatabase interface |
| `getRevisionMembers` | `getApprovalRevisionMembers` | EntityChangeDatabase interface |

### Mapper Object Keys

| Current Name | New Name | Notes |
|--------------|----------|-------|
| `entityChangeMappers.proposal` | `entityChangeMappers.approval` | Mapper function |
| `entityChangeMappers.revision` | `entityChangeMappers.approvalRevision` | Mapper function |
| `entityChangeMappers.revisionMember` | `entityChangeMappers.approvalRevisionMember` | Mapper function |

### Variable/Parameter Names (Common Patterns)

| Current Pattern | New Pattern | Context |
|-----------------|-------------|---------|
| `proposal` | `approval` | Local variables |
| `proposalId` | `approvalId` | Function parameters, local vars |
| `revision` | `approvalRevision` | Local variables |
| `revisionId` | `approvalRevisionId` | Function parameters, local vars |
| `revisionNumber` | `approvalRevisionNumber` | Where clarity needed |
| `toApiProposal` | `toApiApproval` | Helper function |
| `toApiRevision` | `toApiApprovalRevision` | Helper function |
| `toApiBulkProposal` | `toApiBulkApproval` | Helper function |
| `toApiBulkRevision` | `toApiBulkApprovalRevision` | Helper function |
| `findCaseForRevision` | `findCaseForApprovalRevision` | Helper function |
| `findCaseForBulkRevision` | `findCaseForBulkApprovalRevision` | Helper function |

### Database Column Names (DO NOT CHANGE)

These are actual database column names and should remain unchanged:

- `proposal_id` (column in entity_change_case_revision table - legacy naming from old schema)
- `revision_number` (column)
- `base_version` (column)
- `base_state` (column)
- `proposed_state` (column)
- `entity_change_case` (table name - the new model uses "case" terminology)
- `entity_change_case_revision` (table name)
- `entity_change_case_entity_version` (table name)

**Note:** The database schema uses "entity_change_case" terminology (introduced in migration 063). The old "entity_change_proposal" tables were removed in migration 064. However, some column names like `proposal_id` remain for backward compatibility. This renaming task only affects TypeScript code, not the database schema.

### Audit Metadata Field Names (DO NOT CHANGE)

These are stored in JSONB audit metadata and should remain unchanged for backward compatibility:

- `proposalId` (in audit metadata)
- `revisionId` (in audit metadata)
- `governanceCaseId` (in audit metadata)

## Implementation Strategy

### Phase 1: entityChangeDatabase.ts

**Order of operations:**

1. Rename type definitions (top to bottom):
   - Status enums
   - DbResult types
   - DbCreate types
   - Member types
   
2. Update mapper object:
   - Rename keys: `proposal` → `approval`, `revision` → `approvalRevision`, `revisionMember` → `approvalRevisionMember`
   - Keep mapper implementations unchanged (they map DB columns which don't change)

3. Update EntityChangeDatabase interface:
   - Rename all method signatures
   - Update parameter types to use new type names
   - Update return types to use new type names

**Validation:** TypeScript compilation should catch all references that need updating.

### Phase 2: entityChangeOperations.ts

**Order of operations:**

1. Update imports from entityChangeDatabase.ts to use new type names

2. Rename helper functions (top to bottom):
   - `toApiRevision` → `toApiApprovalRevision`
   - `findCaseForRevision` → `findCaseForApprovalRevision`
   - `toApiProposal` → `toApiApproval`
   - `toApiBulkRevision` → `toApiBulkApprovalRevision`
   - `findCaseForBulkRevision` → `findCaseForBulkApprovalRevision`
   - `toApiBulkProposal` → `toApiBulkApproval`

3. Update function implementations:
   - Rename local variables: `proposal` → `approval`, `revision` → `approvalRevision`
   - Rename parameters: `proposalId` → `approvalId`, `revisionId` → `approvalRevisionId`
   - Update db method calls to use new names (e.g., `db.entityChange.createProposal` → `db.entityChange.createApproval`)
   - **Keep audit metadata field names unchanged** (e.g., `{ proposalId, revisionId }` stays as-is)

4. Update governance registry handlers:
   - Rename local variables in `beforeDecision`, `handleDecision`, `applyDomainEffect`
   - Update db method calls
   - **Keep payload field names unchanged** (e.g., `caseRow.payload['proposalId']` stays as-is)

**Special considerations:**
- The `submitProposal` helper function should be renamed to `submitApproval`
- Audit metadata fields (`proposalId`, `revisionId`) should NOT be renamed for backward compatibility
- Case payload fields should NOT be renamed (stored in DB as JSONB)

### Phase 3: entityChange.contract.test.ts

**Order of operations:**

1. Update db method calls to use new names:
   - `db.entityChange.createProposal` → `db.entityChange.createApproval`
   - `db.entityChange.createRevision` → `db.entityChange.createApprovalRevision`
   - `db.entityChange.getLatestRevision` → `db.entityChange.getLatestApprovalRevision`
   - `db.entityChange.listRevisions` → `db.entityChange.listApprovalRevisions`
   - `db.entityChange.createBulkRevision` → `db.entityChange.createBulkApprovalRevision`
   - `db.entityChange.getRevisionMembers` → `db.entityChange.getApprovalRevisionMembers`
   - `db.entityChange.getRevision` → `db.entityChange.getApprovalRevision`

2. Rename local variables:
   - `proposalId` → `approvalId`
   - `revision` → `approvalRevision`
   - `revisionId` → `approvalRevisionId`
   - `bulkProposalId` → `bulkApprovalId`

**Validation:** Tests should pass with identical behavior.

## Terminology Landscape

Understanding the three layers of terminology:

1. **Database Schema (entity_change_case_*)**: The new model introduced in migration 063 uses "case" terminology. Tables are named `entity_change_case`, `entity_change_case_revision`, and `entity_change_case_entity_version`. This is the correct, stable schema.

2. **Public API (EntityChangeApproval)**: The public-facing API contract uses "approval" terminology (renamed in #2341). This is what external consumers see: `EntityChangeApproval`, `EntityChangeApprovalRevision`, etc.

3. **Internal DB Layer Code (currently Proposal/Revision)**: The TypeScript types and functions that interact with the database still use the old "Proposal/Revision" names. **This is what we're renaming** to align with the public API.

**Why "Approval" and not "Case"?**
- The public API already uses "approval" terminology
- The internal code should match the public API for consistency
- The database schema is stable and correct with "case" terminology
- We're only changing TypeScript code, not the database

**Result:** After this change, the code will use "Approval" terminology (matching the public API) while interacting with "case" tables (the database schema). This is intentional and correct.

## Edge Cases and Considerations

### 1. Database Schema Stability
- **DO NOT** change actual database column names (e.g., `proposal_id`, `revision_number`)
- The DB layer types map to these columns, but the type names can change independently
- This avoids requiring a database migration

### 2. Audit Trail Compatibility
- **DO NOT** change audit metadata field names (e.g., `{ proposalId, revisionId }`)
- These are stored as JSONB in the database
- Changing them would break queries against historical audit records

### 3. Governance Case Payloads
- **DO NOT** change case payload field names (e.g., `caseRow.payload['proposalId']`)
- These are stored as JSONB in the governance_case table
- Changing them would break existing open cases

### 4. Type Safety
- TypeScript will catch most references that need updating
- Use `pnpm lint:tsc` to verify no type errors after each phase
- Use `pnpm test` to verify behavior unchanged

### 5. Import Statements
- Update all imports from `entityChangeDatabase.ts` to use new type names
- The file exports will change, so all consumers need updating

### 6. Consistency with Public API
- The public API (entityChangeContract.ts) already uses "approval" terminology
- This change aligns internal code with the public contract
- No changes needed to the public API itself

## Validation Steps

After each phase:

1. **Type Check:** `pnpm lint:tsc` - should pass with no errors
2. **Lint:** `pnpm lint` - should pass with no new warnings
3. **Unit Tests:** `vitest run` - all tests should pass
4. **Contract Tests:** `pnpm --filter @arch-register/server test:db-contract` - should pass
5. **API Tests:** `pnpm --filter @arch-register/e2e test:api` - should pass (if available)

## Success Criteria

- [ ] All type names use "Approval" and "ApprovalRevision" instead of "Proposal" and "Revision"
- [ ] All interface method names updated consistently
- [ ] All local variables and parameters renamed for clarity
- [ ] Database column names remain unchanged
- [ ] Audit metadata field names remain unchanged
- [ ] Case payload field names remain unchanged
- [ ] All TypeScript compilation passes
- [ ] All tests pass with identical behavior
- [ ] No linting errors introduced

## Estimated Effort

- **Phase 1:** ~30 minutes (straightforward type renaming)
- **Phase 2:** ~90 minutes (careful variable renaming, many occurrences)
- **Phase 3:** ~15 minutes (test updates)
- **Validation:** ~15 minutes (run all checks)

**Total:** ~2.5 hours of focused work

## Notes for Implementation

- This is purely mechanical renaming - no logic changes
- Use find-and-replace carefully, but verify each change
- Consider using regex search to find all occurrences: `\b(proposal|Proposal|revision|Revision)\b`
- Work in small commits per phase for easy review
- The large file size (1200+ lines) makes this tedious but straightforward
