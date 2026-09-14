import { describe, expect, it } from 'vitest';
import type { ConformanceCheck } from '@arch-register/api-types/conformanceContract';
import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
import {
  createInitialConformanceCheckFormState,
  initializeConformanceCheckFormState,
  serializeConformanceCheckDefinition,
  serializeConformanceCheckForm
} from './conformanceCheckEditorState';

const makeCheck = (definition: ConformanceCheck['definition']): ConformanceCheck => ({
  id: 'check-1',
  workspace: 'workspace-1',
  name: 'Existing check',
  description: 'Existing description',
  severity: 'warning',
  enabled: false,
  definition,
  revision: 3,
  created_by: null,
  created_at: '2026-09-01T00:00:00.000Z',
  updated_at: '2026-09-02T00:00:00.000Z'
});

describe('conformance check editor state', () => {
  it('creates defaults for a new check without sharing mutable values', () => {
    const draft = createInitialConformanceCheckFormState({
      initialType: 'scheduled_validation',
      defaultSchemaId: 'schema-1'
    });

    expect(draft).toMatchObject({
      type: 'scheduled_validation',
      schemaId: 'schema-1',
      severity: 'error',
      message: 'Entity does not conform',
      prompt: 'Does this entity conform to the stated architecture policy?',
      enabled: true
    });
    expect(draft.queryConditions).toEqual([]);
    expect(draft.fieldIds).toEqual([]);
    expect(draft.tools).toEqual([]);
  });

  it('initializes scheduled validation and AI prompt definitions', () => {
    const scheduled = initializeConformanceCheckFormState({
      check: makeCheck({
        type: 'scheduled_validation',
        schemaId: 'schema-2',
        expression: 'entity.lifecycle == "active"',
        message: 'Use an active lifecycle',
        fieldId: 'lifecycle',
        governance: { enabled: true, resolution: 'resolve' }
      }),
      initialType: 'scheduled_validation',
      defaultSchemaId: 'schema-1'
    });
    expect(scheduled).toMatchObject({
      name: 'Existing check',
      description: 'Existing description',
      severity: 'warning',
      enabled: false,
      schemaId: 'schema-2',
      expression: 'entity.lifecycle == "active"',
      message: 'Use an active lifecycle',
      fieldId: 'lifecycle',
      governanceEnabled: true,
      governanceResolution: 'resolve'
    });

    const ai = initializeConformanceCheckFormState({
      check: makeCheck({
        type: 'ai_prompt',
        schemaId: 'schema-3',
        prompt: 'Check the policy fields.',
        fieldIds: ['owner', 'status'],
        tools: ['query_entities']
      }),
      initialType: 'scheduled_validation'
    });
    expect(ai).toMatchObject({
      type: 'ai_prompt',
      schemaId: 'schema-3',
      prompt: 'Check the policy fields.',
      fieldIds: ['owner', 'status'],
      tools: ['query_entities']
    });
  });

  it('initializes query policies in basic or advanced mode without sharing fetched data', () => {
    const basicQuery: EntityQuery = {
      root: {
        kind: 'and',
        children: [
          { kind: 'predicate', path: [], fieldId: '_lifecycle', op: 'equals', value: 'active' }
        ]
      }
    };
    const basic = initializeConformanceCheckFormState({
      check: makeCheck({
        type: 'query_policy',
        query: basicQuery,
        message: 'Active entities only'
      }),
      initialType: 'query_policy'
    });
    expect(basic.queryMode).toBe('basic');
    expect(basic.queryConditions).toEqual([
      { fieldId: '_lifecycle', op: 'equals', value: 'active' }
    ]);
    expect(basic.queryJson).toBe(JSON.stringify(basicQuery, null, 2));

    const advancedQuery: EntityQuery = {
      root: {
        kind: 'not',
        child: { kind: 'predicate', path: [], fieldId: 'status', op: 'equals', value: 'retired' }
      }
    };
    expect(
      initializeConformanceCheckFormState({
        check: makeCheck({ type: 'query_policy', query: advancedQuery, message: 'Not retired' }),
        initialType: 'query_policy'
      }).queryMode
    ).toBe('advanced');
  });

  it('serializes scheduled validation with normalized metadata and governance', () => {
    const draft = createInitialConformanceCheckFormState({
      initialType: 'scheduled_validation',
      defaultSchemaId: 'schema-1'
    });
    Object.assign(draft, {
      name: '  Lifecycle check  ',
      description: '  A check  ',
      severity: 'warning',
      expression: '  entity.lifecycle != null  ',
      message: '  Lifecycle is required  ',
      fieldId: 'lifecycle',
      governanceEnabled: true,
      governanceResolution: 'acknowledge'
    });

    expect(serializeConformanceCheckForm(draft, true)).toEqual({
      name: 'Lifecycle check',
      description: 'A check',
      severity: 'warning',
      enabled: true,
      definition: {
        type: 'scheduled_validation',
        schemaId: 'schema-1',
        expression: 'entity.lifecycle != null',
        message: 'Lifecycle is required',
        fieldId: 'lifecycle',
        governance: { enabled: true, resolution: 'acknowledge' }
      }
    });
  });

  it('serializes basic and advanced query policies and rejects invalid advanced JSON', () => {
    const draft = createInitialConformanceCheckFormState({ initialType: 'query_policy' });
    draft.message = '';
    draft.queryConditions = [{ fieldId: '_lifecycle', op: 'equals', value: 'active' }];

    const basic = serializeConformanceCheckDefinition(draft, true);
    expect(basic).toMatchObject({
      type: 'query_policy',
      message: 'Entity does not conform',
      query: {
        root: {
          kind: 'and',
          children: [
            { kind: 'predicate', path: [], fieldId: '_lifecycle', op: 'equals', value: 'active' }
          ]
        }
      }
    });

    draft.queryMode = 'advanced';
    draft.queryJson = '{not valid json';
    expect(serializeConformanceCheckDefinition(draft, true)).toBeNull();

    const advancedQuery: EntityQuery = {
      root: {
        kind: 'not',
        child: { kind: 'predicate', path: [], fieldId: 'status', op: 'equals', value: 'retired' }
      }
    };
    draft.queryJson = JSON.stringify(advancedQuery);
    expect(serializeConformanceCheckDefinition(draft, true)).toMatchObject({
      type: 'query_policy',
      query: advancedQuery
    });
  });

  it('requires AI configuration and selected fields before serializing an AI check', () => {
    const draft = createInitialConformanceCheckFormState({
      initialType: 'ai_prompt',
      defaultSchemaId: 'schema-1'
    });
    draft.name = 'Policy AI check';
    draft.fieldIds = ['status'];

    expect(serializeConformanceCheckForm(draft, false)).toBeNull();
    expect(serializeConformanceCheckForm(draft, true)).toMatchObject({
      name: 'Policy AI check',
      definition: {
        type: 'ai_prompt',
        schemaId: 'schema-1',
        fieldIds: ['status'],
        tools: []
      }
    });
  });
});
