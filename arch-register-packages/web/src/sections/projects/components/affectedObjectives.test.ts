import { describe, expect, it } from 'vitest';
import type { RelationRecord } from '@arch-register/api-types/relationContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type { WorkspaceCapabilityConfiguration } from '@arch-register/api-types/workspaceCapabilityContract';
import {
  combineAffectedObjectives,
  existingEntityMemberIds,
  extractAffectedObjectives,
  resolveAffectedObjectiveConfig
} from './affectedObjectives';

const relationSchema = {
  id: 'runtime-objective-impact',
  name: 'Objective Affects Entity',
  in: { schemaIds: ['runtime-objective'] },
  out: { schemaIds: 'any', label: 'Affected by Objective' }
} as RelationSchema;

const capabilityConfiguration = {
  type: 'strategy-model',
  valid: true,
  bindings: { objective: { target: { kind: 'entity_schema', id: 'runtime-objective' } } }
} as unknown as WorkspaceCapabilityConfiguration;

const makeRecord = ({
  id,
  objectiveId,
  objectiveName,
  schemaId = relationSchema.id,
  objectiveSchemaId = 'runtime-objective'
}: {
  id: string;
  objectiveId: string;
  objectiveName: string;
  schemaId?: string;
  objectiveSchemaId?: string;
}) =>
  ({
    _uid: id,
    _schema: { id: schemaId, name: 'Relation' },
    _in: { id: objectiveId, name: objectiveName, schemaId: objectiveSchemaId },
    _out: { id: 'entity-1', name: 'Entity', schemaId: 'entity-schema' }
  }) as RelationRecord;

describe('affected objectives', () => {
  it('resolves the runtime impact relation from the strategy objective binding', () => {
    expect(resolveAffectedObjectiveConfig([relationSchema], [capabilityConfiguration])).toEqual({
      objectiveSchemaId: 'runtime-objective',
      relationSchemaId: 'runtime-objective-impact'
    });
  });

  it('hides the summary when strategy configuration or impact relation is unavailable', () => {
    expect(resolveAffectedObjectiveConfig([relationSchema], [])).toBeNull();
    expect(
      resolveAffectedObjectiveConfig(
        [relationSchema],
        [{ ...capabilityConfiguration, valid: false }]
      )
    ).toBeNull();
    expect(
      resolveAffectedObjectiveConfig(
        [{ ...relationSchema, out: { schemaIds: 'any', label: 'Other label' } }],
        [capabilityConfiguration]
      )
    ).toBeNull();
  });

  it('filters to objective impact records and returns stable unique objectives', () => {
    const config = resolveAffectedObjectiveConfig([relationSchema], [capabilityConfiguration]);
    expect(
      extractAffectedObjectives(
        [
          makeRecord({ id: 'rel-1', objectiveId: 'objective-b', objectiveName: 'Beta' }),
          makeRecord({ id: 'rel-2', objectiveId: 'objective-a', objectiveName: 'Alpha' }),
          makeRecord({ id: 'rel-3', objectiveId: 'objective-a', objectiveName: 'Alpha' }),
          makeRecord({
            id: 'rel-4',
            objectiveId: 'objective-other',
            objectiveName: 'Other schema objective',
            objectiveSchemaId: 'other-schema'
          }),
          makeRecord({
            id: 'rel-5',
            objectiveId: 'objective-support',
            objectiveName: 'Support relation',
            schemaId: 'other-relation'
          })
        ],
        config
      )
    ).toEqual([
      { id: 'objective-a', name: 'Alpha' },
      { id: 'objective-b', name: 'Beta' }
    ]);
  });

  it('deduplicates objectives across entity members and excludes drafts', () => {
    const byMember = new Map([
      ['entity-2', [{ id: 'objective-b', name: 'Beta' }]],
      [
        'entity-1',
        [
          { id: 'objective-a', name: 'Alpha' },
          { id: 'objective-b', name: 'Beta' }
        ]
      ]
    ]);

    expect(combineAffectedObjectives(byMember)).toEqual([
      { id: 'objective-a', name: 'Alpha' },
      { id: 'objective-b', name: 'Beta' }
    ]);
    expect(existingEntityMemberIds(['draft:new', 'entity-2', 'entity-1', 'entity-2'])).toEqual([
      'entity-1',
      'entity-2'
    ]);
  });
});
