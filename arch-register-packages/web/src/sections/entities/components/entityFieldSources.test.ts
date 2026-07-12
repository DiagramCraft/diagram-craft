import { describe, expect, it } from 'vitest';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { Assessment } from '@arch-register/api-types/assessmentContract';
import type { WorkspaceEnum } from '@arch-register/api-types/enumContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import type { WorkspaceTeam } from '@arch-register/api-types/workspaceConfigContract';
import {
  getCategoricalFields,
  getCategoricalFieldValues,
  getCategoricalValue,
  getNumericFields,
  getNumericValue,
  getNumericFieldRange,
  LIFECYCLE_FIELD_ID,
  OWNER_FIELD_ID
} from './entityFieldSources';

const schema = {
  id: 'service',
  name: 'Service',
  fields: [
    { id: 'technology', name: 'Technology', type: 'text' },
    {
      id: 'phase',
      name: 'Phase',
      type: 'select',
      enumId: 'phase',
      options: [
        { value: 'prod', label: 'Production' },
        { value: 'dev', label: 'Development' }
      ]
    },
    { id: 'score', name: 'Score', type: 'number', min: 0, max: 10 }
  ]
} as EntitySchema;

const lifecycleStates: WorkspaceLifecycleState[] = [
  { id: 'live', label: 'Live', sort_order: 1 } as WorkspaceLifecycleState,
  { id: 'deprecated', label: 'Deprecated', sort_order: 0 } as WorkspaceLifecycleState
];

const teams: WorkspaceTeam[] = [{ id: 'team-1', name: 'Platform', sort_order: 0 } as WorkspaceTeam];

const assessment: Assessment = {
  id: 'assessment-1',
  workspace: 'ws-1',
  project_id: 'proj-1',
  name: 'Security review',
  description: '',
  status: 'open',
  scope: ['service'],
  scope_conditions: [],
  fields: [
    { id: 'rating1', label: 'Rating', requirementLevel: 'required', type: 'rating' },
    { id: 'enum1', label: 'Risk', requirementLevel: 'optional', type: 'enum', enumId: 'risk-enum' }
  ],
  response_count: 0,
  completed_entity_count: 0,
  created_at: '',
  updated_at: ''
};

const enums: WorkspaceEnum[] = [
  {
    id: 'risk-enum',
    workspace: 'ws-1',
    name: 'Risk',
    options: [
      { value: 'low', label: 'Low' },
      { value: 'high', label: 'High' }
    ],
    sort_order: 0,
    created_at: '',
    updated_at: ''
  }
];

const joinedAssessment = { assessment, enums };

describe('getCategoricalFields', () => {
  it('unions select fields across schemas, deduping by id', () => {
    const duplicate = { ...schema, id: 'app', name: 'Application' };
    const fields = getCategoricalFields([schema, duplicate], [], []);
    expect(fields.filter(f => f.id === 'phase')).toHaveLength(1);
    expect(fields.some(f => f.id === 'technology')).toBe(false);
  });

  it('adds Lifecycle/Owner options only when data is present', () => {
    expect(getCategoricalFields([schema], [], [])).not.toContainEqual({
      id: LIFECYCLE_FIELD_ID,
      label: 'Lifecycle'
    });
    expect(getCategoricalFields([schema], lifecycleStates, teams)).toEqual(
      expect.arrayContaining([
        { id: LIFECYCLE_FIELD_ID, label: 'Lifecycle' },
        { id: OWNER_FIELD_ID, label: 'Owner' }
      ])
    );
  });

  it('includes enum assessment fields but excludes rating fields by default', () => {
    const fields = getCategoricalFields([schema], [], [], joinedAssessment);
    expect(fields.some(f => f.id === '_assessment:enum1')).toBe(true);
    expect(fields.some(f => f.id === '_assessment:rating1')).toBe(false);
  });

  it('includes rating assessment fields when includeRatingFields is set', () => {
    const fields = getCategoricalFields([schema], [], [], joinedAssessment, true);
    expect(fields.some(f => f.id === '_assessment:rating1')).toBe(true);
  });
});

describe('getNumericFields', () => {
  it('includes number fields and rating assessment fields', () => {
    const fields = getNumericFields([schema], joinedAssessment);
    expect(fields).toEqual(
      expect.arrayContaining([
        { id: 'score', label: 'Score' },
        { id: '_assessment:rating1', label: 'Rating' }
      ])
    );
  });
});

describe('getCategoricalFieldValues', () => {
  it('returns the 1-5 rating bucket values for a rating-typed assessment field', () => {
    const values = getCategoricalFieldValues([schema], '_assessment:rating1', [], [], joinedAssessment);
    expect(values).toEqual([
      { id: '1', label: '1' },
      { id: '2', label: '2' },
      { id: '3', label: '3' },
      { id: '4', label: '4' },
      { id: '5', label: '5' }
    ]);
  });

  it('returns enum options for an enum-typed assessment field', () => {
    const values = getCategoricalFieldValues([schema], '_assessment:enum1', [], [], joinedAssessment);
    expect(values).toEqual([
      { id: 'low', label: 'Low' },
      { id: 'high', label: 'High' }
    ]);
  });

  it('returns select field options', () => {
    const values = getCategoricalFieldValues([schema], 'phase', [], []);
    expect(values).toEqual([
      { id: 'prod', label: 'Production' },
      { id: 'dev', label: 'Development' }
    ]);
  });

  it('returns sorted lifecycle states', () => {
    const values = getCategoricalFieldValues([schema], LIFECYCLE_FIELD_ID, lifecycleStates, []);
    expect(values).toEqual([
      { id: 'deprecated', label: 'Deprecated' },
      { id: 'live', label: 'Live' }
    ]);
  });
});

describe('getCategoricalValue / getNumericValue', () => {
  it('resolves assessment values off a joined entity', () => {
    const entity = { _assessment: { rating1: 4, enum1: 'high' } } as unknown as EntityRecord;
    expect(getCategoricalValue(entity, '_assessment:enum1')).toBe('high');
    expect(getNumericValue(entity, '_assessment:rating1')).toBe(4);
  });

  it('returns null when there is no joined assessment response', () => {
    const entity = {} as EntityRecord;
    expect(getCategoricalValue(entity, '_assessment:enum1')).toBeNull();
    expect(getNumericValue(entity, '_assessment:rating1')).toBeNull();
  });

  it('resolves lifecycle and owner ids', () => {
    const entity = {
      _lifecycle: { id: 'live', name: 'Live' },
      _owner: { id: 'team-1', name: 'Platform' }
    } as unknown as EntityRecord;
    expect(getCategoricalValue(entity, LIFECYCLE_FIELD_ID)).toBe('live');
    expect(getCategoricalValue(entity, OWNER_FIELD_ID)).toBe('team-1');
  });
});

describe('getNumericFieldRange', () => {
  it('returns the fixed 1-5 range for rating assessment fields', () => {
    const range = getNumericFieldRange([schema], '_assessment:rating1', joinedAssessment, []);
    expect(range).toEqual({ min: 1, max: 5 });
  });

  it('uses the declared field min/max when a single schema defines it', () => {
    const range = getNumericFieldRange([schema], 'score', undefined, []);
    expect(range).toEqual({ min: 0, max: 10 });
  });

  it('falls back to the observed data range otherwise', () => {
    const entities = [{ unscored: 3 }, { unscored: 7 }] as unknown as EntityRecord[];
    const range = getNumericFieldRange([], 'unscored', undefined, entities);
    expect(range).toEqual({ min: 3, max: 7 });
  });
});
