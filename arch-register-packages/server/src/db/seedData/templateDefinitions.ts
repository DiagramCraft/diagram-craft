import { randomUUID } from 'node:crypto';
import type {
  SchemaDbResult,
  SharedFieldGroupDbResult,
  WorkspaceEnumDbResult
} from '../../domain/catalog/db/catalogDatabase';
import type { RelationSchemaDbResult } from '../../domain/catalog/db/relationDatabase';
import { compileSchemaWithSharedGroups } from '../../domain/catalog/fieldGroupHelpers';
import { compileRelationSchemaWithSharedGroups } from '../../domain/catalog/relationSchemaHelpers';
import {
  instantiateTemplateComposition,
  type InstantiatedTemplateComposition,
  type TemplateDefinitionKind,
  type TemplateInstantiationOptions
} from '../../domain/catalog/schemaTemplates';
import {
  BUSINESS_CAPABILITY_SUPPORTS_ENTITY_RELATION_SCHEMA_ID,
  CONTROL_REQUIREMENT_SCHEMA_ID,
  DATA_FLOW_GOVERNANCE_FIELD_GROUP_ID,
  DATA_FLOW_SCHEMA_ID,
  GLOSSARY_IDS,
  INFO_ASSET_FIELD_GROUP_ID,
  INFO_ASSET_IDS,
  OBJECTIVE_AFFECTS_ENTITY_RELATION_SCHEMA_ID,
  OBJECTIVE_SUPPORTS_BUSINESS_CAPABILITY_RELATION_SCHEMA_ID,
  PII_FIELD_GROUP_ID,
  RETENTION_IDS,
  RISK_AFFECTS_RELATION_SCHEMA_ID,
  RISK_CONTROL_SCHEMA_ID,
  SEED_ENUM_IDS,
  SEED_RELATION_SCHEMA_IDS,
  SEED_SCHEMA_IDS,
  SEED_SCHEMA_KEY_PREFIXES,
  STRATEGY_IDS,
  API_CONSUMER_RELATION_SCHEMA_ID,
  API_PROVIDER_RELATION_SCHEMA_ID,
  WORKSPACE_ID,
  now
} from './constants';

const definitionId = (
  kind: TemplateDefinitionKind,
  templateId: string,
  symbolicId: string,
  sharedId?: string
): string => {
  if (kind === 'enum' && sharedId === 'pii-classification') {
    return SEED_ENUM_IDS.piiClassification;
  }
  if (kind === 'fieldGroup' && sharedId === 'pii-classification') {
    return PII_FIELD_GROUP_ID;
  }

  const ids: Partial<Record<string, string>> = {
    'schema:default:domain': SEED_SCHEMA_IDS.domain,
    'schema:default:system': SEED_SCHEMA_IDS.system,
    'schema:default:component': SEED_SCHEMA_IDS.component,
    'schema:default:api': SEED_SCHEMA_IDS.api,
    'schema:default:resource': SEED_SCHEMA_IDS.resource,
    'schema:default:contract': SEED_SCHEMA_IDS.contract,
    'schema:default:vendor': SEED_SCHEMA_IDS.vendor,
    'schema:default:technology': SEED_SCHEMA_IDS.technology,
    'schema:default:technology_release': SEED_SCHEMA_IDS.technologyRelease,
    'schema:glossary:term_category': GLOSSARY_IDS.termCategorySchema,
    'schema:glossary:term': GLOSSARY_IDS.termSchema,
    'schema:information-governance:retention-policy': RETENTION_IDS.policySchema,
    'schema:information-governance:data-entity': SEED_SCHEMA_IDS.dataEntity,
    'schema:risk-compliance:risk': SEED_SCHEMA_IDS.risk,
    'schema:risk-compliance:control': SEED_SCHEMA_IDS.control,
    'schema:risk-compliance:framework': SEED_SCHEMA_IDS.framework,
    'schema:risk-compliance:compliance_requirement': SEED_SCHEMA_IDS.complianceRequirement,
    'schema:strategy:business_capability': STRATEGY_IDS.businessCapabilitySchema,
    'schema:strategy:objective': STRATEGY_IDS.objectiveSchema,
    'schema:strategy:outcome': STRATEGY_IDS.outcomeSchema,
    'schema:strategy:initiative': STRATEGY_IDS.initiativeSchema,
    'schema:strategy:measure': STRATEGY_IDS.measureSchema,

    'enum:default:api-type': SEED_ENUM_IDS.apiType,
    'enum:default:communication-protocol': SEED_ENUM_IDS.communicationProtocol,
    'enum:default:contract-purpose': SEED_ENUM_IDS.contractPurpose,
    'enum:default:technology-category': SEED_ENUM_IDS.technologyCategory,
    'enum:default:technology-radar-status': SEED_ENUM_IDS.technologyRadarStatus,
    'enum:glossary:glossary-status': GLOSSARY_IDS.statusEnum,
    'enum:information-governance:data-flow-direction': SEED_ENUM_IDS.dataFlowDirection,
    'enum:information-governance:regulatory-tags': INFO_ASSET_IDS.regulatoryTagsEnum,
    'enum:information-governance:processing-purposes': INFO_ASSET_IDS.processingPurposesEnum,
    'enum:information-governance:residency-regions': INFO_ASSET_IDS.residencyRegionsEnum,
    'enum:information-governance:retention-time-unit': RETENTION_IDS.timeUnitEnum,
    'enum:risk-compliance:risk-status': SEED_ENUM_IDS.riskStatus,
    'enum:risk-compliance:risk-mitigation-effectiveness': SEED_ENUM_IDS.mitigationEffectiveness,
    'enum:risk-compliance:rc-control-type': SEED_ENUM_IDS.controlType,
    'enum:risk-compliance:control-effectiveness': SEED_ENUM_IDS.controlEffectiveness,
    'enum:risk-compliance:framework-kind': SEED_ENUM_IDS.frameworkKind,
    'enum:risk-compliance:requirement-status': SEED_ENUM_IDS.requirementStatus,
    'enum:strategy:strategy-status': STRATEGY_IDS.statusEnum,

    'fieldGroup:information-governance:information-asset-stewardship': INFO_ASSET_FIELD_GROUP_ID,
    'fieldGroup:information-governance:data-flow-governance': DATA_FLOW_GOVERNANCE_FIELD_GROUP_ID,

    'relationSchema:default:provides-api': API_PROVIDER_RELATION_SCHEMA_ID,
    'relationSchema:default:consumes-api': API_CONSUMER_RELATION_SCHEMA_ID,
    'relationSchema:default:system-contract': SEED_RELATION_SCHEMA_IDS.systemContract,
    'relationSchema:information-governance:retention-assignment':
      RETENTION_IDS.assignmentRelationSchema,
    'relationSchema:information-governance:data-flow:data-flow': DATA_FLOW_SCHEMA_ID,
    'relationSchema:risk-compliance:risk-control': RISK_CONTROL_SCHEMA_ID,
    'relationSchema:risk-compliance:control-requirement': CONTROL_REQUIREMENT_SCHEMA_ID,
    'relationSchema:risk-compliance:risk-affects': RISK_AFFECTS_RELATION_SCHEMA_ID,
    'relationSchema:strategy:business-capability-supports-entity':
      BUSINESS_CAPABILITY_SUPPORTS_ENTITY_RELATION_SCHEMA_ID,
    'relationSchema:strategy:objective-supports-business-capability':
      OBJECTIVE_SUPPORTS_BUSINESS_CAPABILITY_RELATION_SCHEMA_ID,
    'relationSchema:strategy:objective-affects-entity': OBJECTIVE_AFFECTS_ENTITY_RELATION_SCHEMA_ID
  };

  const key = `${kind}:${templateId}:${symbolicId}`;
  const stable = ids[key];
  if (stable) return stable;

  // Document definitions are not part of the seed catalog parity boundary. They are included in
  // the composition so this resolver can be reused without making the demo fixture depend on
  // document ids that are intentionally generated at runtime.
  if (kind === 'documentType' || kind === 'documentTemplate') return randomUUID();
  throw new Error(`No stable seed id configured for ${key}`);
};

const schemaKeyPrefix = (_workspaceId: string, templateId: string, symbolicId: string): string => {
  const prefixes: Partial<Record<string, string>> = {
    'default:domain': SEED_SCHEMA_KEY_PREFIXES.domain,
    'default:system': SEED_SCHEMA_KEY_PREFIXES.system,
    'default:component': SEED_SCHEMA_KEY_PREFIXES.component,
    'default:api': SEED_SCHEMA_KEY_PREFIXES.api,
    'default:resource': SEED_SCHEMA_KEY_PREFIXES.resource,
    'default:contract': SEED_SCHEMA_KEY_PREFIXES.contract,
    'default:vendor': SEED_SCHEMA_KEY_PREFIXES.vendor,
    'default:technology': SEED_SCHEMA_KEY_PREFIXES.technology,
    'default:technology_release': SEED_SCHEMA_KEY_PREFIXES.technologyRelease,
    'glossary:term_category': SEED_SCHEMA_KEY_PREFIXES.termCategory,
    'glossary:term': SEED_SCHEMA_KEY_PREFIXES.term,
    'information-governance:data-entity': SEED_SCHEMA_KEY_PREFIXES.dataEntity,
    'information-governance:retention-policy': SEED_SCHEMA_KEY_PREFIXES.retentionPolicy,
    'risk-compliance:risk': SEED_SCHEMA_KEY_PREFIXES.risk,
    'risk-compliance:control': SEED_SCHEMA_KEY_PREFIXES.control,
    'risk-compliance:framework': SEED_SCHEMA_KEY_PREFIXES.framework,
    'risk-compliance:compliance_requirement': SEED_SCHEMA_KEY_PREFIXES.complianceRequirement,
    'strategy:business_capability': SEED_SCHEMA_KEY_PREFIXES.businessCapability,
    'strategy:objective': SEED_SCHEMA_KEY_PREFIXES.objective,
    'strategy:outcome': SEED_SCHEMA_KEY_PREFIXES.outcome,
    'strategy:initiative': SEED_SCHEMA_KEY_PREFIXES.initiative,
    'strategy:measure': SEED_SCHEMA_KEY_PREFIXES.measure
  };
  const prefix = prefixes[`${templateId}:${symbolicId}`];
  if (!prefix)
    throw new Error(`No stable seed key prefix configured for ${templateId}:${symbolicId}`);
  return prefix;
};

const seedTemplateInstantiationOptions: TemplateInstantiationOptions = {
  idFactory: definitionId,
  schemaKeyPrefixFactory: schemaKeyPrefix,
  dependencyMappings: [
    {
      dependencyId: 'information-governance:data-flow:system',
      targets: [{ templateId: 'default', symId: 'system' }]
    }
  ]
};

const rawSeedTemplateDefinitions = instantiateTemplateComposition(
  WORKSPACE_ID,
  'default',
  ['glossary', 'information-governance', 'risk-compliance', 'strategy'],
  now,
  seedTemplateInstantiationOptions
);

const sharedFieldGroups = rawSeedTemplateDefinitions.fieldGroups as SharedFieldGroupDbResult[];

const definitionOrder = <T>(
  items: readonly T[],
  ids: readonly string[],
  getId: (item: T) => string
) => [...items].sort((left, right) => ids.indexOf(getId(left)) - ids.indexOf(getId(right)));

const schemaOrder = [
  SEED_SCHEMA_IDS.domain,
  SEED_SCHEMA_IDS.system,
  SEED_SCHEMA_IDS.component,
  SEED_SCHEMA_IDS.contract,
  SEED_SCHEMA_IDS.vendor,
  SEED_SCHEMA_IDS.api,
  SEED_SCHEMA_IDS.resource,
  SEED_SCHEMA_IDS.dataEntity,
  SEED_SCHEMA_IDS.technology,
  SEED_SCHEMA_IDS.technologyRelease,
  SEED_SCHEMA_IDS.risk,
  SEED_SCHEMA_IDS.control,
  SEED_SCHEMA_IDS.framework,
  SEED_SCHEMA_IDS.complianceRequirement,
  SEED_SCHEMA_IDS.termCategory,
  SEED_SCHEMA_IDS.term,
  SEED_SCHEMA_IDS.businessCapability,
  SEED_SCHEMA_IDS.objective,
  SEED_SCHEMA_IDS.outcome,
  SEED_SCHEMA_IDS.initiative,
  SEED_SCHEMA_IDS.measure,
  SEED_SCHEMA_IDS.retentionPolicy
];

const enumOrder = [
  SEED_ENUM_IDS.apiType,
  SEED_ENUM_IDS.technologyCategory,
  SEED_ENUM_IDS.technologyRadarStatus,
  SEED_ENUM_IDS.piiClassification,
  SEED_ENUM_IDS.dataFlowDirection,
  SEED_ENUM_IDS.communicationProtocol,
  SEED_ENUM_IDS.contractPurpose,
  SEED_ENUM_IDS.riskStatus,
  SEED_ENUM_IDS.mitigationEffectiveness,
  SEED_ENUM_IDS.controlType,
  SEED_ENUM_IDS.controlEffectiveness,
  SEED_ENUM_IDS.frameworkKind,
  SEED_ENUM_IDS.requirementStatus,
  SEED_ENUM_IDS.glossaryStatus,
  SEED_ENUM_IDS.strategyStatus,
  SEED_ENUM_IDS.retentionTimeUnit,
  SEED_ENUM_IDS.regulatoryTags,
  SEED_ENUM_IDS.processingPurposes,
  SEED_ENUM_IDS.residencyRegions
];

const relationOrder = [
  API_PROVIDER_RELATION_SCHEMA_ID,
  API_CONSUMER_RELATION_SCHEMA_ID,
  SEED_RELATION_SCHEMA_IDS.systemContract,
  DATA_FLOW_SCHEMA_ID,
  RISK_AFFECTS_RELATION_SCHEMA_ID,
  RISK_CONTROL_SCHEMA_ID,
  CONTROL_REQUIREMENT_SCHEMA_ID,
  BUSINESS_CAPABILITY_SUPPORTS_ENTITY_RELATION_SCHEMA_ID,
  OBJECTIVE_SUPPORTS_BUSINESS_CAPABILITY_RELATION_SCHEMA_ID,
  OBJECTIVE_AFFECTS_ENTITY_RELATION_SCHEMA_ID,
  RETENTION_IDS.assignmentRelationSchema
];

const orderedSchemas = definitionOrder(
  rawSeedTemplateDefinitions.schemas,
  schemaOrder,
  item => item.id
).map(schema => compileSchemaWithSharedGroups(schema, sharedFieldGroups));
const orderedEnums = definitionOrder(
  rawSeedTemplateDefinitions.enums,
  enumOrder,
  item => item.id
).map((enumeration, index): WorkspaceEnumDbResult => ({ ...enumeration, sort_order: index }));
const orderedFieldGroups = definitionOrder(
  rawSeedTemplateDefinitions.fieldGroups,
  [PII_FIELD_GROUP_ID, INFO_ASSET_FIELD_GROUP_ID, DATA_FLOW_GOVERNANCE_FIELD_GROUP_ID],
  item => item.id
).map((fieldGroup, index): SharedFieldGroupDbResult => ({ ...fieldGroup, sort_order: index + 3 }));
const orderedRelationSchemas = definitionOrder(
  rawSeedTemplateDefinitions.relationSchemas,
  relationOrder,
  item => item.id
).map(relationSchema => compileRelationSchemaWithSharedGroups(relationSchema, sharedFieldGroups));

export const seedTemplateDefinitions: InstantiatedTemplateComposition = {
  ...rawSeedTemplateDefinitions,
  schemas: orderedSchemas,
  enums: orderedEnums,
  fieldGroups: orderedFieldGroups,
  relationSchemas: orderedRelationSchemas
};

export const seedTemplateCategoryDefinitions = seedTemplateDefinitions.categories;
export const seedTemplateSchemaDefinitions: SchemaDbResult[] = seedTemplateDefinitions.schemas;
export const seedTemplateEnumDefinitions: WorkspaceEnumDbResult[] = seedTemplateDefinitions.enums;
export const seedTemplateFieldGroupDefinitions: SharedFieldGroupDbResult[] =
  seedTemplateDefinitions.fieldGroups;
export const seedTemplateRelationSchemaDefinitions: RelationSchemaDbResult[] =
  seedTemplateDefinitions.relationSchemas;

export const SEED_CAPABILITY_CONFIGURATION_IDS = {
  'api-specification': '00000000-0000-0000-0000-000000000007',
  'business-glossary': '00000000-0000-0000-0000-000000000008',
  'strategy-model': '00000000-0000-0000-0000-00000000000a',
  retention: RETENTION_IDS.capabilityConfiguration
} as const;
