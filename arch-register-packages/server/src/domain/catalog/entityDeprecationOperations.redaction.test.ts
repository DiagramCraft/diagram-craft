import { describe, expect, it, vi } from 'vitest';
import { buildAuthorizationContext } from '@arch-register/permissions';
import type { DatabaseAdapter } from '../../db/database';
import type { EntityDbResult, SchemaDbResult } from './db/catalogDatabase';
import type { GovernanceCaseDbResult } from '../governance/db/governanceDatabase';
import { redactDeprecationCasePayload } from './entityDeprecationOperations';

const now = new Date('2026-08-07T12:00:00.000Z');

const affectedEntity: EntityDbResult = {
  id: 'entity-affected',
  workspace: 'ws-1',
  public_id: 'SRV-2',
  slug: 'affected',
  namespace: 'default',
  name: 'Affected service',
  description: '',
  owner: 'team-owner',
  lifecycle: null,
  target_lifecycle: null,
  target_lifecycle_date: null,
  tags: [],
  links: [],
  schema_id: 'schema-affected',
  data: {},
  project_id: null,
  created_at: now,
  updated_at: now,
  owner_name: 'Platform',
  lifecycle_label: null,
  target_lifecycle_label: null,
  schema_name: 'Affected service',
  completeness: 100
};

const affectedSchema: SchemaDbResult = {
  id: 'schema-affected',
  workspace: 'ws-1',
  name: 'Affected service',
  description: '',
  fields: [
    {
      id: 'dependency',
      name: 'Dependency',
      type: 'reference',
      groupId: 'restricted'
    } as never
  ],
  groups: [{ id: 'restricted', name: 'Restricted', accessControl: { teamIds: ['team-owner'] } }],
  templates: [],
  color: null,
  icon: null,
  default_owner: null,
  key_prefix: 'SRV',
  created_at: now,
  updated_at: now
};

const impactEntry = {
  entityId: affectedEntity.id,
  entityName: affectedEntity.name,
  entitySlug: affectedEntity.slug,
  entitySchemaId: affectedEntity.schema_id,
  schemaName: affectedSchema.name,
  ownerTeamId: affectedEntity.owner,
  fieldName: 'Dependency',
  kind: 'reference' as const
};

const makeDb = (): DatabaseAdapter =>
  ({
    catalog: {
      listSchemas: vi.fn(async () => [affectedSchema]),
      listEntitiesPaginated: vi.fn(async () => [affectedEntity])
    }
  }) as unknown as DatabaseAdapter;

const caseRow = {
  id: 'case-1',
  workspace: 'ws-1',
  case_kind: 'entity.deprecation',
  payload: { baselineImpact: [impactEntry], reason: 'retire service' }
} as unknown as GovernanceCaseDbResult;

describe('redactDeprecationCasePayload', () => {
  it('omits impact entries whose source field is not visible', async () => {
    const authCtx = buildAuthorizationContext({
      userId: 'user-1',
      globalRoles: [],
      workspaceRole: 'editor',
      teamAssignments: [],
      schemas: [],
      entities: [],
      grants: []
    });

    await expect(
      redactDeprecationCasePayload({ db: makeDb(), authCtx, caseRow, mode: 'api' })
    ).resolves.toEqual({ baselineImpact: [], reason: 'retire service' });
  });

  it('keeps impact entries for a caller with field-group access', async () => {
    const authCtx = buildAuthorizationContext({
      userId: 'user-1',
      globalRoles: [],
      workspaceRole: 'editor',
      teamAssignments: [{ teamId: 'team-owner', role: 'team_reviewer' }],
      schemas: [],
      entities: [],
      grants: []
    });

    await expect(
      redactDeprecationCasePayload({ db: makeDb(), authCtx, caseRow, mode: 'api' })
    ).resolves.toEqual({ baselineImpact: [impactEntry], reason: 'retire service' });
  });
});
