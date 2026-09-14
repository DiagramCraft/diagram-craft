import type {
  ConformanceCheck,
  ConformanceCheckDefinition,
  ConformanceSeverity,
  CreateConformanceCheck
} from '@arch-register/api-types/conformanceContract';
import type { DocumentAiToolId } from '@arch-register/api-types/documentContract';
import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
import type { FilterCondition } from '@arch-register/api-types/viewContract';
import {
  buildEntityQueryFromBrowserFilters,
  entityQueryToBrowserFilters,
  isBasicRepresentable
} from '../../entities/components/entityBrowserState';

export type CheckType = ConformanceCheckDefinition['type'];
export type QueryEditMode = 'basic' | 'advanced';
export type GovernanceResolution = 'acknowledge' | 'resolve';

export type ConformanceCheckFormState = {
  type: CheckType;
  name: string;
  description: string;
  severity: ConformanceSeverity;
  schemaId: string;
  fieldId: string;
  expression: string;
  message: string;
  queryMode: QueryEditMode;
  queryConditions: FilterCondition[];
  queryJson: string;
  queryJsonError: string | null;
  prompt: string;
  fieldIds: string[];
  tools: DocumentAiToolId[];
  governanceEnabled: boolean;
  governanceResolution: GovernanceResolution;
  enabled: boolean;
};

export const DEFAULT_CONFORMANCE_MESSAGE = 'Entity does not conform';
export const DEFAULT_CONFORMANCE_PROMPT =
  'Does this entity conform to the stated architecture policy?';

export const defaultEntityQuery: EntityQuery = { root: { kind: 'and', children: [] } };
export const defaultQuery = JSON.stringify(defaultEntityQuery, null, 2);

export const createInitialConformanceCheckFormState = ({
  initialType,
  defaultSchemaId = ''
}: {
  initialType: CheckType;
  defaultSchemaId?: string;
}): ConformanceCheckFormState => ({
  type: initialType,
  name: '',
  description: '',
  severity: 'error',
  schemaId: defaultSchemaId,
  fieldId: '',
  expression: '',
  message: DEFAULT_CONFORMANCE_MESSAGE,
  queryMode: 'basic',
  queryConditions: [],
  queryJson: defaultQuery,
  queryJsonError: null,
  prompt: DEFAULT_CONFORMANCE_PROMPT,
  fieldIds: [],
  tools: [],
  governanceEnabled: false,
  governanceResolution: 'acknowledge',
  enabled: true
});

export const initializeConformanceCheckFormState = ({
  check,
  initialType,
  defaultSchemaId = ''
}: {
  check: ConformanceCheck | null;
  initialType: CheckType;
  defaultSchemaId?: string;
}): ConformanceCheckFormState => {
  const initial = createInitialConformanceCheckFormState({ initialType, defaultSchemaId });
  if (!check) return initial;

  const definition = check.definition;
  const state: ConformanceCheckFormState = {
    ...initial,
    type: definition.type,
    name: check.name,
    description: check.description ?? '',
    severity: check.severity,
    enabled: check.enabled,
    governanceEnabled: definition.governance?.enabled ?? false,
    governanceResolution: definition.governance?.resolution ?? 'acknowledge'
  };

  if (definition.type === 'scheduled_validation') {
    return {
      ...state,
      schemaId: definition.schemaId,
      fieldId: definition.fieldId ?? '',
      expression: definition.expression,
      message: definition.message
    };
  }

  if (definition.type === 'query_policy') {
    return {
      ...state,
      queryMode: isBasicRepresentable(definition.query) ? 'basic' : 'advanced',
      queryConditions: entityQueryToBrowserFilters(definition.query).conditions,
      queryJson: JSON.stringify(definition.query, null, 2),
      message: definition.message
    };
  }

  return {
    ...state,
    schemaId: definition.schemaId,
    prompt: definition.prompt,
    fieldIds: [...definition.fieldIds],
    tools: [...(definition.tools ?? [])]
  };
};

const nonEmptyOrDefault = (value: string, fallback: string) => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
};

export const serializeConformanceCheckDefinition = (
  state: ConformanceCheckFormState,
  aiConfigured: boolean
): ConformanceCheckDefinition | null => {
  if (state.type === 'scheduled_validation') {
    if (!state.schemaId || !state.expression.trim()) return null;
    return {
      type: state.type,
      schemaId: state.schemaId,
      expression: state.expression.trim(),
      message: nonEmptyOrDefault(state.message, DEFAULT_CONFORMANCE_MESSAGE),
      ...(state.fieldId ? { fieldId: state.fieldId } : {}),
      governance: {
        enabled: state.governanceEnabled,
        resolution: state.governanceResolution
      }
    };
  }

  if (state.type === 'ai_prompt') {
    if (!state.schemaId || !state.prompt.trim() || state.fieldIds.length === 0 || !aiConfigured) {
      return null;
    }
    return {
      type: state.type,
      schemaId: state.schemaId,
      prompt: state.prompt.trim(),
      fieldIds: [...state.fieldIds],
      tools: [...state.tools],
      governance: {
        enabled: state.governanceEnabled,
        resolution: state.governanceResolution
      }
    };
  }

  const query =
    state.queryMode === 'basic'
      ? buildEntityQueryFromBrowserFilters({
          typeFilter: null,
          conditions: state.queryConditions
        })
      : parseEntityQuery(state.queryJson);
  if (!query) return null;

  return {
    type: state.type,
    query,
    message: nonEmptyOrDefault(state.message, DEFAULT_CONFORMANCE_MESSAGE),
    governance: {
      enabled: state.governanceEnabled,
      resolution: state.governanceResolution
    }
  };
};

const parseEntityQuery = (value: string): EntityQuery | null => {
  try {
    return JSON.parse(value) as EntityQuery;
  } catch {
    return null;
  }
};

export const serializeConformanceCheckForm = (
  state: ConformanceCheckFormState,
  aiConfigured: boolean
): CreateConformanceCheck | null => {
  const definition = serializeConformanceCheckDefinition(state, aiConfigured);
  if (!definition || !state.name.trim()) return null;
  return {
    name: state.name.trim(),
    description: state.description.trim().length > 0 ? state.description.trim() : null,
    severity: state.severity,
    enabled: state.enabled,
    definition
  };
};
