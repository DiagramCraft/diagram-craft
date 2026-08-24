import { buildAuthorizationContext } from '@arch-register/permissions';
import { describe, expect, it, vi } from 'vitest';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import type { SchemaDbResult, EntityDbResult } from '../catalog/db/catalogDatabase';
import type { ConformanceViolationDbResult } from './db/conformanceDatabase';

const mocks = vi.hoisted(() => ({
  buildApiEntityAuthCtx: vi.fn(),
  requireWorkspaceCapability: vi.fn()
}));

vi.mock('../auth/authorization', () => ({
  buildApiEntityAuthCtx: mocks.buildApiEntityAuthCtx,
  requireWorkspaceCapability: mocks.requireWorkspaceCapability
}));

const { getConformanceSummary, listConformanceViolations } = await import(
  './conformanceOperations'
);

const now = new Date('2026-08-24T12:00:00.000Z');

const schema: SchemaDbResult = {
  id: 'schema-1',
  workspace: 'ws-1',
  name: 'Service',
  description: '',
  fields: [
    {
      id: 'public_field',
      name: 'Public field',
      type: 'text',
      requirementLevel: 'optional'
    },
    {
      id: 'secret_field',
      name: 'Secret field',
      type: 'text',
      requirementLevel: 'optional',
      groupId: 'restricted'
    }
  ],
  templates: [],
  groups: [
    {
      id: 'restricted',
      name: 'Restricted',
      accessControl: { teamIds: ['team-restricted'] }
    }
  ],
  color: null,
  icon: null,
  default_owner: null,
  key_prefix: 'SRV',
  created_at: now,
  updated_at: now
};

const makeEntity = (id: string, name: string): EntityDbResult => ({
  id,
  public_id: id,
  workspace: 'ws-1',
  slug: id,
  namespace: 'default',
  name,
  description: '',
  owner: null,
  lifecycle: null,
  target_lifecycle: null,
  target_lifecycle_date: null,
  tags: [],
  links: [],
  schema_id: schema.id,
  data: {},
  project_id: null,
  created_at: now,
  updated_at: now,
  completeness: 0,
  owner_name: null,
  lifecycle_label: null,
  target_lifecycle_label: null,
  schema_name: schema.name
});

const visibleEntity = makeEntity('entity-visible', 'Visible');
const hiddenEntity = makeEntity('entity-hidden', 'Hidden');

const makeViolation = (id: string, entity: EntityDbResult): ConformanceViolationDbResult => ({
  id,
  workspace: 'ws-1',
  check_id: 'check-1',
  check_name: 'Service policy',
  entity_id: entity.id,
  entity_name: entity.name,
  schema_id: schema.id,
  owner_team_id: null,
  source_type: 'query_policy',
  severity: 'error',
  message: 'Service policy failed',
  evidence: {
    type: 'query_policy',
    public_field: 'visible',
    secret_field: 'must be hidden'
  },
  status: 'active',
  first_seen_at: now,
  last_seen_at: now,
  resolved_at: null,
  exemption: null
});

const makeAuthContext = (teamAssignments: Array<{ teamId: string; role: 'team_reviewer' }>) =>
  buildAuthorizationContext({
    userId: 'user-1',
    globalRoles: [],
    workspaceRole: null,
    teamAssignments,
    schemas: [schema],
    entities: [visibleEntity],
    grants: [
      {
        id: 'grant-visible',
        workspace: 'ws-1',
        entity_id: visibleEntity.id,
        principal_type: 'user',
        principal_id: 'user-1',
        role: 'editor',
        applies_to: 'self',
        created_at: now
      }
    ]
  });

const event = { context: { user: { id: 'user-1' } } } as unknown as AuthenticatedEvent;

const makeDatabase = (violations: ConformanceViolationDbResult[]) =>
  ({
    catalog: {
      getEntity: vi.fn(async (_workspace: string, id: string) =>
        id === visibleEntity.id ? visibleEntity : id === hiddenEntity.id ? hiddenEntity : null
      ),
      listSchemas: vi.fn(async () => [schema])
    },
    conformance: {
      listViolations: vi.fn(async () => ({ items: violations, total: violations.length })),
      listRuns: vi.fn(async () => [])
    }
  }) as unknown as DatabaseAdapter;

describe('conformance violation visibility', () => {
  it('redacts restricted evidence and excludes hidden entities from results and summaries', async () => {
    const authCtx = makeAuthContext([]);
    mocks.buildApiEntityAuthCtx.mockResolvedValue(authCtx);
    const db = makeDatabase([
      makeViolation('violation-visible', visibleEntity),
      makeViolation('violation-hidden', hiddenEntity)
    ]);

    const page = await listConformanceViolations(
      db,
      'ws-1',
      {
        limit: 50,
        offset: 0
      },
      event
    );

    expect(page.total).toBe(1);
    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.evidence).toEqual({
      type: 'query_policy',
      public_field: 'visible'
    });

    const summary = await getConformanceSummary(db, 'ws-1', authCtx, event);
    expect(summary.active).toBe(1);
    expect(summary.bySchema).toEqual([{ id: schema.id, name: schema.name, count: 1 }]);
  });

  it('retains restricted evidence for a caller with field-group view access', async () => {
    const authCtx = makeAuthContext([{ teamId: 'team-restricted', role: 'team_reviewer' }]);
    mocks.buildApiEntityAuthCtx.mockResolvedValue(authCtx);
    const db = makeDatabase([makeViolation('violation-visible', visibleEntity)]);

    const page = await listConformanceViolations(
      db,
      'ws-1',
      {
        limit: 50,
        offset: 0
      },
      event
    );

    expect(page.items[0]?.evidence).toEqual({
      type: 'query_policy',
      public_field: 'visible',
      secret_field: 'must be hidden'
    });
  });

  it('drops the whole evidence payload when a scheduled_validation fieldId is restricted', async () => {
    const authCtx = makeAuthContext([]);
    mocks.buildApiEntityAuthCtx.mockResolvedValue(authCtx);
    const violation: ConformanceViolationDbResult = {
      ...makeViolation('violation-scheduled', visibleEntity),
      source_type: 'scheduled_validation',
      evidence: { ruleId: 'check-1', fieldId: 'secret_field', schemaVersion: 1 }
    };
    const db = makeDatabase([violation]);

    const page = await listConformanceViolations(db, 'ws-1', { limit: 50, offset: 0 }, event);

    expect(page.items[0]?.evidence).toEqual({ redacted: true });
  });

  it('keeps scheduled_validation evidence when the referenced field is visible', async () => {
    const authCtx = makeAuthContext([]);
    mocks.buildApiEntityAuthCtx.mockResolvedValue(authCtx);
    const violation: ConformanceViolationDbResult = {
      ...makeViolation('violation-scheduled', visibleEntity),
      source_type: 'scheduled_validation',
      evidence: { ruleId: 'check-1', fieldId: 'public_field', schemaVersion: 1 }
    };
    const db = makeDatabase([violation]);

    const page = await listConformanceViolations(db, 'ws-1', { limit: 50, offset: 0 }, event);

    expect(page.items[0]?.evidence).toEqual({
      ruleId: 'check-1',
      fieldId: 'public_field',
      schemaVersion: 1
    });
  });
});
