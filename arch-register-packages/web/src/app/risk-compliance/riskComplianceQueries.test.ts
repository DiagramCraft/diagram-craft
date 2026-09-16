import { describe, expect, it } from 'vitest';
import type { WorkspaceCapabilityConfiguration } from '@arch-register/api-types/workspaceCapabilityContract';
import {
  resolveRiskComplianceConfig,
  resolveRetentionConfig,
  resolveRetentionFieldIds
} from './riskComplianceQueries';

const entityBinding = (id: string) => ({ target: { kind: 'entity_schema' as const, id } });
const relationBinding = (id: string) => ({ target: { kind: 'relation_schema' as const, id } });

const validRiskComplianceConfiguration = {
  type: 'risk-compliance',
  valid: true,
  bindings: {
    risk: entityBinding('risk-schema'),
    control: entityBinding('control-schema'),
    framework: entityBinding('framework-schema'),
    complianceRequirement: entityBinding('compliance-requirement-schema'),
    dataEntity: entityBinding('data-entity-schema')
  }
} as unknown as WorkspaceCapabilityConfiguration;

describe('resolveRiskComplianceConfig', () => {
  it('resolves the risk, control, framework, complianceRequirement, and dataEntity bindings from a valid configuration', () => {
    expect(resolveRiskComplianceConfig([validRiskComplianceConfiguration])).toEqual({
      riskSchemaId: 'risk-schema',
      controlSchemaId: 'control-schema',
      frameworkSchemaId: 'framework-schema',
      complianceRequirementSchemaId: 'compliance-requirement-schema',
      dataEntitySchemaId: 'data-entity-schema'
    });
  });

  it('resolves with a null control/framework/complianceRequirement/dataEntity schema id when unbound', () => {
    const {
      control: _control,
      framework: _framework,
      complianceRequirement: _complianceRequirement,
      dataEntity: _dataEntity,
      ...bindingsWithoutOptionals
    } = validRiskComplianceConfiguration.bindings;
    expect(
      resolveRiskComplianceConfig([
        { ...validRiskComplianceConfiguration, bindings: bindingsWithoutOptionals }
      ])
    ).toEqual({
      riskSchemaId: 'risk-schema',
      controlSchemaId: null,
      frameworkSchemaId: null,
      complianceRequirementSchemaId: null,
      dataEntitySchemaId: null
    });
  });

  it('returns null when there is no risk-compliance configuration', () => {
    expect(resolveRiskComplianceConfig([])).toBeNull();
    expect(resolveRiskComplianceConfig(undefined)).toBeNull();
  });

  it('returns null when the configuration is invalid', () => {
    expect(
      resolveRiskComplianceConfig([{ ...validRiskComplianceConfiguration, valid: false }])
    ).toBeNull();
  });

  it('returns null when the required risk binding is missing or unbound', () => {
    const { risk: _risk, ...bindingsWithoutRisk } = validRiskComplianceConfiguration.bindings;
    expect(
      resolveRiskComplianceConfig([
        { ...validRiskComplianceConfiguration, bindings: bindingsWithoutRisk }
      ])
    ).toBeNull();
    expect(
      resolveRiskComplianceConfig([
        {
          ...validRiskComplianceConfiguration,
          bindings: { ...validRiskComplianceConfiguration.bindings, risk: entityBinding('') }
        }
      ])
    ).toBeNull();
  });
});

const validRetentionConfiguration = {
  type: 'retention',
  valid: true,
  bindings: {
    policy: entityBinding('policy-schema'),
    assignment: relationBinding('assignment-schema')
  }
} as unknown as WorkspaceCapabilityConfiguration;

describe('resolveRetentionConfig', () => {
  it('resolves the policy and assignment bindings from a valid retention configuration', () => {
    expect(resolveRetentionConfig([validRetentionConfiguration])).toEqual({
      policySchemaId: 'policy-schema',
      assignmentSchemaId: 'assignment-schema'
    });
  });

  it('returns null when there is no retention configuration', () => {
    expect(resolveRetentionConfig([])).toBeNull();
    expect(resolveRetentionConfig(undefined)).toBeNull();
  });

  it('returns null when the configuration is invalid', () => {
    expect(resolveRetentionConfig([{ ...validRetentionConfiguration, valid: false }])).toBeNull();
  });

  it('returns null when the required policy or assignment binding is missing or unbound', () => {
    const { policy: _policy, ...bindingsWithoutPolicy } = validRetentionConfiguration.bindings;
    expect(
      resolveRetentionConfig([{ ...validRetentionConfiguration, bindings: bindingsWithoutPolicy }])
    ).toBeNull();

    const { assignment: _assignment, ...bindingsWithoutAssignment } =
      validRetentionConfiguration.bindings;
    expect(
      resolveRetentionConfig([
        { ...validRetentionConfiguration, bindings: bindingsWithoutAssignment }
      ])
    ).toBeNull();
  });
});

describe('resolveRetentionFieldIds', () => {
  it('resolves the default field ids when no explicit field mappings are set', () => {
    expect(resolveRetentionFieldIds([validRetentionConfiguration])).toEqual({
      durationFieldId: 'duration',
      timeUnitFieldId: 'time_unit',
      activatedFromFieldId: 'activated_from'
    });
  });

  it('resolves explicit field mappings over the defaults', () => {
    const remapped = {
      ...validRetentionConfiguration,
      bindings: {
        policy: {
          ...validRetentionConfiguration.bindings.policy,
          fieldMappings: { duration: 'retention_length', timeUnit: 'retention_unit' }
        },
        assignment: {
          ...validRetentionConfiguration.bindings.assignment,
          fieldMappings: { activatedFrom: 'subject_since' }
        }
      }
    } as unknown as WorkspaceCapabilityConfiguration;
    expect(resolveRetentionFieldIds([remapped])).toEqual({
      durationFieldId: 'retention_length',
      timeUnitFieldId: 'retention_unit',
      activatedFromFieldId: 'subject_since'
    });
  });

  it('returns null when there is no retention configuration', () => {
    expect(resolveRetentionFieldIds([])).toBeNull();
    expect(resolveRetentionFieldIds(undefined)).toBeNull();
  });

  it('returns null when the configuration is invalid', () => {
    expect(resolveRetentionFieldIds([{ ...validRetentionConfiguration, valid: false }])).toBeNull();
  });

  it('returns null when the policy or assignment binding is missing', () => {
    const { policy: _policy, ...bindingsWithoutPolicy } = validRetentionConfiguration.bindings;
    expect(
      resolveRetentionFieldIds([
        { ...validRetentionConfiguration, bindings: bindingsWithoutPolicy }
      ])
    ).toBeNull();
  });
});
