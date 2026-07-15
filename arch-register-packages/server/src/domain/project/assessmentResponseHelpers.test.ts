import { describe, expect, it } from 'vitest';
import {
  toApiAssessmentResponse,
  countCompletedEntities,
  buildAssessmentResultsCsvData
} from './assessmentResponseHelpers';
import type { AssessmentDbResult, AssessmentResponseDbResult } from './db/projectDatabase';
import type { EntityDbResult, WorkspaceEnumDbResult } from '../catalog/db/catalogDatabase';

const now = new Date('2026-06-01T12:00:00.000Z');

const makeAssessment = (overrides: Partial<AssessmentDbResult> = {}): AssessmentDbResult => ({
  id: 'asmnt-1',
  workspace: 'ws-1',
  project_id: 'proj-1',
  name: 'Security Readiness',
  description: '',
  status: 'open',
  scope: ['schema-service'],
  scope_conditions: [],
  fields: [
    {
      id: 'f1',
      label: 'Auth maturity',
      type: 'enum',
      enumId: 'enum-maturity',
      requirementLevel: 'required'
    },
    { id: 'f2', label: 'Notes', type: 'text', requirementLevel: 'optional' }
  ],
  created_at: now,
  updated_at: now,
  ...overrides
});

const makeResponse = (
  overrides: Partial<AssessmentResponseDbResult> = {}
): AssessmentResponseDbResult => ({
  id: 'resp-1',
  workspace: 'ws-1',
  assessment_id: 'asmnt-1',
  entity_id: 'entity-1',
  values: {},
  created_at: now,
  updated_at: now,
  updated_by: null,
  updated_by_name: null,
  ...overrides
});

describe('toApiAssessmentResponse', () => {
  it('maps a db row and derives status from required fields', () => {
    const assessment = makeAssessment();
    const row = makeResponse({ values: { f1: 'Managed' } });
    const result = toApiAssessmentResponse(row, assessment);
    expect(result.entity_id).toBe('entity-1');
    expect(result.status).toBe('complete');
    expect(result.updated_at).toBe(now.toISOString());
  });

  it('is not_started when no required fields are answered', () => {
    const assessment = makeAssessment();
    const row = makeResponse({ values: { f2: 'some notes' } });
    expect(toApiAssessmentResponse(row, assessment).status).toBe('not_started');
  });

  it('is complete when there are no required fields at all', () => {
    const assessment = makeAssessment({
      fields: [{ id: 'f2', label: 'Notes', type: 'text', requirementLevel: 'optional' }]
    });
    const row = makeResponse({ values: {} });
    expect(toApiAssessmentResponse(row, assessment).status).toBe('complete');
  });
});

describe('countCompletedEntities', () => {
  it('counts only responses whose required fields are all filled', () => {
    const assessment = makeAssessment();
    const responses = [
      makeResponse({ entity_id: 'e1', values: { f1: 'Managed' } }),
      makeResponse({ entity_id: 'e2', values: {} }),
      makeResponse({ entity_id: 'e3', values: { f1: 'Defined', f2: 'note' } })
    ];
    expect(countCompletedEntities(responses, assessment)).toBe(2);
  });
});

const makeEntity = (overrides: Partial<EntityDbResult> = {}): EntityDbResult => ({
  id: 'entity-1',
  workspace: 'ws-1',
  public_id: 'SVC-001',
  slug: 'entity-1',
  namespace: '',
  name: 'Payments Service',
  description: '',
  owner: 'owner-1',
  lifecycle: null,
  target_lifecycle: null,
  target_lifecycle_date: null,
  tags: [],
  links: [],
  schema_id: 'schema-service',
  data: {},
  visibility_mode: null,
  created_at: now,
  updated_at: now,
  owner_name: 'Jane Doe',
  lifecycle_label: null,
  target_lifecycle_label: null,
  schema_name: 'Service',
  ...overrides
});

const enumDef: WorkspaceEnumDbResult = {
  id: 'enum-maturity',
  workspace: 'ws-1',
  name: 'Maturity',
  options: [
    { value: 'Managed', label: 'Managed' },
    { value: 'Defined', label: 'Defined' }
  ],
  sort_order: 0,
  created_at: now,
  updated_at: now
};

describe('buildAssessmentResultsCsvData', () => {
  it('includes all in-scope entities, blank cells for unanswered fields', () => {
    const assessment = makeAssessment();
    const entities = [
      makeEntity({ id: 'e1', name: 'Alpha' }),
      makeEntity({ id: 'e2', name: 'Beta', owner: null, owner_name: null })
    ];
    const responses = [makeResponse({ entity_id: 'e1', values: { f1: 'Managed', f2: 'note' } })];

    const { columns, rows } = buildAssessmentResultsCsvData(entities, responses, assessment, [
      enumDef
    ]);

    expect(columns).toEqual(['Entity', 'Owner', 'Schema Type', 'Auth maturity', 'Notes', 'Status']);
    expect(rows).toEqual([
      {
        Entity: 'Alpha',
        Owner: 'Jane Doe',
        'Schema Type': 'Service',
        'Auth maturity': 'Managed',
        Notes: 'note',
        Status: 'complete'
      },
      {
        Entity: 'Beta',
        Owner: '',
        'Schema Type': 'Service',
        'Auth maturity': '',
        Notes: '',
        Status: 'not_started'
      }
    ]);
  });

  it('excludes entities outside the assessment scope', () => {
    const assessment = makeAssessment();
    const entities = [
      makeEntity({ id: 'e1' }),
      makeEntity({ id: 'e2', schema_id: 'schema-other' })
    ];

    const { rows } = buildAssessmentResultsCsvData(entities, [], assessment, []);

    expect(rows).toHaveLength(1);
  });

  it('excludes entities that do not match assessment scope conditions', () => {
    const assessment = makeAssessment({
      scope_conditions: [{ fieldId: '_owner', op: 'equals', value: 'owner-1' }]
    });
    const entities = [
      makeEntity({ id: 'e1', owner: 'owner-1' }),
      makeEntity({ id: 'e2', owner: 'owner-2' })
    ];

    const { rows } = buildAssessmentResultsCsvData(entities, [], assessment, []);

    expect(rows).toHaveLength(1);
    expect(rows[0]!.Entity).toBe('Payments Service');
  });

  it('resolves enum values to their labels', () => {
    const assessment = makeAssessment();
    const entities = [makeEntity({ id: 'e1' })];
    const responses = [makeResponse({ entity_id: 'e1', values: { f1: 'Defined' } })];

    const { rows } = buildAssessmentResultsCsvData(entities, responses, assessment, [enumDef]);

    expect(rows[0]!['Auth maturity']).toBe('Defined');
  });
});
