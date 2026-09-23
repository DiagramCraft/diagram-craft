import { z } from 'zod';
import { metricTraversalStepSchema, type MetricTraversalStep } from './metricContract';
import type { RelationSchema } from './relationSchemaContract';
import {
  DEFAULT_STRATEGY_VIEW_CONFIG,
  strategyModelViewConfigSchema
} from './app/strategy-model/strategyModelViewConfig';
import { businessGlossaryCapabilityDefinition } from './app/business-glossary/glossaryCapability';
import { getWorkspaceCapabilityDefinition, resolveCapabilityFieldId } from './integrationCatalog';
import type { WorkspaceCapabilityBinding } from './workspaceCapabilityContract';

export const entityDrawerMetadataSlotSchema = z.enum([
  'slug',
  'description',
  'owner',
  'lifecycle',
  'targetLifecycle',
  'targetLifecycleDate',
  'tags',
  'publicId',
  'namespace'
]);

const labelOverrideSchema = z.string().min(1).max(120).optional();
const entityDrawerItemPresentationSchema = z.enum(['row', 'mini-panel']).optional();
export const entityDrawerSlotOptionsSchema = z.record(z.string(), z.unknown());

export const VENDOR_CAPABILITIES_FUNDED_PLACEHOLDER_MESSAGE =
  'Not yet available — no linked capability data yet.';

/** Aggregation and number-format options for a `rollup` drawer item. Kept local to this file
 *  (rather than imported from Strategy's `strategyModelViewConfig.ts`) so the generic drawer item
 *  contract doesn't depend on a specific capability's config model. */
export const entityDrawerRollupAggregationSchema = z.enum(['avg', 'sum', 'count']);
export const entityDrawerRollupFormatSchema = z.enum(['number', 'decimal1', 'currency', 'percent']);
export const entityDrawerRollupTraversalSchema = metricTraversalStepSchema;

export const entityDrawerItemSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('field'),
    fieldId: z.string().min(1),
    label: labelOverrideSchema,
    presentation: entityDrawerItemPresentationSchema
  }),
  z.object({
    kind: z.literal('metadata'),
    slot: entityDrawerMetadataSlotSchema,
    label: labelOverrideSchema
  }),
  z.object({
    kind: z.literal('relation'),
    fieldId: z.string().min(1),
    label: labelOverrideSchema,
    presentation: entityDrawerItemPresentationSchema
  }),
  z.object({
    kind: z.literal('children'),
    childSchemaId: z.string().min(1),
    fieldId: z.string().min(1),
    label: labelOverrideSchema
  }),
  z.object({
    kind: z.literal('slot'),
    slotId: z.string().min(1),
    label: labelOverrideSchema,
    showLabel: z.boolean().optional(),
    presentation: entityDrawerItemPresentationSchema,
    options: entityDrawerSlotOptionsSchema.optional()
  }),
  z.object({
    kind: z.literal('rollup'),
    fieldId: z.string().min(1),
    sourceSchemaId: z.string().min(1).optional(),
    traversal: entityDrawerRollupTraversalSchema.optional(),
    aggregation: entityDrawerRollupAggregationSchema,
    format: entityDrawerRollupFormatSchema,
    label: labelOverrideSchema,
    showLabel: z.boolean().optional()
  }),
  z.object({
    kind: z.literal('rollup-leaf-count'),
    label: labelOverrideSchema,
    showLabel: z.boolean().optional()
  }),
  z.object({
    kind: z.literal('placeholder'),
    message: z.string().min(1)
  }),
  z.object({
    kind: z.literal('typed-relation-list'),
    fieldId: z.string().min(1),
    label: labelOverrideSchema,
    showLabel: z.boolean().optional(),
    attributes: z
      .array(z.object({ fieldId: z.string().min(1), label: labelOverrideSchema }))
      .optional()
  }),
  z.object({
    kind: z.literal('query'),
    queryText: z.string().min(1),
    label: labelOverrideSchema,
    showLabel: z.boolean().optional(),
    presentation: z.enum(['chips', 'list']).optional(),
    fields: z.array(z.object({ fieldId: z.string().min(1), label: labelOverrideSchema })).optional()
  })
]);

export const entityDrawerBadgeSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('field'),
    fieldId: z.string().min(1),
    label: labelOverrideSchema,
    showLabel: z.boolean().optional()
  }),
  z.object({
    kind: z.literal('metadata'),
    slot: entityDrawerMetadataSlotSchema,
    label: labelOverrideSchema
  })
]);

export const entityDrawerProfileSchema = z.object({
  header: z.object({ badges: z.array(entityDrawerBadgeSchema) }).default({ badges: [] }),
  sections: z.array(
    z.object({
      id: z.string().min(1).max(120),
      title: z.string().min(1).max(120),
      showTitle: z.boolean().optional(),
      layout: z.enum(['rows', 'stat-grid']).optional(),
      collapsible: z.boolean().default(true),
      items: z.array(entityDrawerItemSchema)
    })
  )
});

export const entityDrawerConfigurationSchema = z.object({
  version: z.literal(1),
  profiles: z.record(z.string().min(1), entityDrawerProfileSchema)
});

export const entityDrawerDiagnosticSchema = z.object({
  code: z.enum([
    'invalid_configuration',
    'unknown_version',
    'missing_schema',
    'missing_or_archived_field',
    'missing_relation_field',
    'invalid_children_target',
    'unsupported_slot',
    'invalid_slot_options',
    'unsupported_slot_for_schema',
    'unsupported_rollup_schema',
    'invalid_rollup_traversal'
  ]),
  schemaId: z.string().optional(),
  sectionId: z.string().optional(),
  itemId: z.string().optional(),
  message: z.string()
});

export const entityDrawerCatalogFieldSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  archived: z.boolean(),
  groupId: z.string().nullable(),
  schemaId: z.string().nullable().optional()
});

export const entityDrawerCatalogSchema = z.object({
  schemas: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      fields: z.array(entityDrawerCatalogFieldSchema)
    })
  ),
  metadataSlots: z.array(
    z.object({ id: entityDrawerMetadataSlotSchema, label: z.string(), description: z.string() })
  ),
  slots: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      description: z.string(),
      application: z.string(),
      fixedPresentation: z.enum(['row', 'mini-panel']).optional(),
      supportedSchemaIds: z.array(z.string()),
      defaultOptions: entityDrawerSlotOptionsSchema,
      optionFields: z.array(
        z.object({ id: z.string(), label: z.string(), description: z.string() })
      )
    })
  )
});

export type EntityDrawerMetadataSlot = z.infer<typeof entityDrawerMetadataSlotSchema>;
export type EntityDrawerItem = z.infer<typeof entityDrawerItemSchema>;
export type EntityDrawerBadge = z.infer<typeof entityDrawerBadgeSchema>;
export type EntityDrawerProfile = z.infer<typeof entityDrawerProfileSchema>;
export type EntityDrawerConfiguration = z.infer<typeof entityDrawerConfigurationSchema>;
export type EntityDrawerProfiles = EntityDrawerConfiguration['profiles'];
export type EntityDrawerDiagnostic = z.infer<typeof entityDrawerDiagnosticSchema>;
export type EntityDrawerCatalog = z.infer<typeof entityDrawerCatalogSchema>;
export type EntityDrawerRollupTraversal = MetricTraversalStep;
export type EntityDrawerSlotDefinition = {
  id: string;
  label: string;
  description: string;
  application: string;
  fixedPresentation?: 'row' | 'mini-panel';
  capabilityBinding?: { capabilityType: string; role: string };
  defaultOptions: Record<string, unknown>;
  optionFields: Array<{ id: string; label: string; description: string }>;
  optionsSchema: z.ZodTypeAny;
};

export const remapEntityDrawerProfiles = (
  profiles: EntityDrawerProfiles,
  schemaIdMap: ReadonlyMap<string, string>,
  relationSchemaIdMap: ReadonlyMap<string, string> = new Map()
): EntityDrawerProfiles =>
  Object.fromEntries(
    Object.entries(profiles).flatMap(([schemaId, profile]) => {
      const mappedSchemaId = schemaIdMap.get(schemaId);
      if (!mappedSchemaId) return [];
      return [
        [
          mappedSchemaId,
          {
            ...profile,
            sections: profile.sections.map(section => ({
              ...section,
              items: section.items.map(item =>
                item.kind === 'children'
                  ? {
                      ...item,
                      childSchemaId: schemaIdMap.get(item.childSchemaId) ?? item.childSchemaId
                    }
                  : item.kind === 'rollup'
                    ? {
                        ...item,
                        ...(item.sourceSchemaId
                          ? {
                              sourceSchemaId:
                                schemaIdMap.get(item.sourceSchemaId) ?? item.sourceSchemaId
                            }
                          : {}),
                        ...(item.traversal
                          ? {
                              traversal:
                                item.traversal.kind === 'relation'
                                  ? {
                                      ...item.traversal,
                                      ...(item.traversal.ownerSchemaId
                                        ? {
                                            ownerSchemaId:
                                              schemaIdMap.get(item.traversal.ownerSchemaId) ??
                                              item.traversal.ownerSchemaId
                                          }
                                        : {})
                                    }
                                  : item.traversal.kind === 'typedRelation' ||
                                      item.traversal.kind === 'unboundTypedRelation'
                                    ? {
                                        ...item.traversal,
                                        relationSchemaId:
                                          relationSchemaIdMap.get(
                                            item.traversal.relationSchemaId
                                          ) ?? item.traversal.relationSchemaId
                                      }
                                    : item.traversal
                            }
                          : {})
                      }
                    : item
              )
            }))
          }
        ] as const
      ];
    })
  );

export const mergeEntityDrawerProfiles = (
  existing: EntityDrawerProfiles,
  incoming: EntityDrawerProfiles
): EntityDrawerProfiles => ({ ...incoming, ...existing });

type CapabilityConfigurationLike = {
  type: string;
  bindings: Record<string, WorkspaceCapabilityBinding>;
  view_config?: unknown;
};

export type EntityDrawerRelationSchema = Pick<RelationSchema, 'id' | 'in' | 'out'>;

export const ENTITY_DRAWER_METADATA_SLOTS: EntityDrawerCatalog['metadataSlots'] = [
  { id: 'publicId', label: 'Public ID', description: 'The stable public identifier.' },
  { id: 'slug', label: 'Slug', description: 'The entity slug, when present.' },
  { id: 'description', label: 'Description', description: 'The entity description.' },
  { id: 'owner', label: 'Owner', description: 'The assigned owner.' },
  { id: 'lifecycle', label: 'Lifecycle', description: 'The entity lifecycle state.' },
  { id: 'targetLifecycle', label: 'Target lifecycle', description: 'The target lifecycle state.' },
  { id: 'targetLifecycleDate', label: 'Target lifecycle date', description: 'The target date.' },
  { id: 'tags', label: 'Tags', description: 'The entity tags.' },
  { id: 'namespace', label: 'Namespace', description: 'The entity namespace.' }
];

const emptyOptionsSchema = z.record(z.string(), z.unknown());

export const ENTITY_DRAWER_SLOT_DEFINITIONS: EntityDrawerSlotDefinition[] = [
  {
    id: 'api-specification.catalog',
    label: 'API specification catalog',
    description: 'Sources, revisions, diagnostics, and normalized API operations or messages.',
    application: 'API & Integration Catalog',
    capabilityBinding: { capabilityType: 'api-specification', role: 'api' },
    defaultOptions: {},
    optionFields: [],
    optionsSchema: emptyOptionsSchema
  },
  {
    id: 'entity.usage',
    label: 'Entity usage',
    description:
      'Visible entities, relations, documents, projects, and diagrams that reference the current entity.',
    application: 'Entity',
    defaultOptions: {},
    optionFields: [],
    optionsSchema: emptyOptionsSchema
  },
  {
    id: 'entity.governance-items',
    label: 'Governance items',
    description: 'Open governance cases associated with the current entity.',
    application: 'Governance',
    defaultOptions: {},
    optionFields: [],
    optionsSchema: emptyOptionsSchema
  },
  {
    id: 'entity.change-cases',
    label: 'Change cases',
    description: 'Change cases associated with the current entity.',
    application: 'Data Stewardship',
    defaultOptions: {},
    optionFields: [],
    optionsSchema: emptyOptionsSchema
  },
  {
    id: 'entity.assessments',
    label: 'Assessments',
    description: 'Assessments associated with the current entity.',
    application: 'Data Stewardship',
    defaultOptions: {},
    optionFields: [],
    optionsSchema: emptyOptionsSchema
  },
  {
    id: 'vendor.technology-lifecycle',
    label: 'Technology lifecycle',
    description: 'Technology lifecycle summary.',
    application: 'Vendor Management',
    capabilityBinding: { capabilityType: 'vendor-management', role: 'vendor' },
    defaultOptions: {},
    optionFields: [],
    optionsSchema: emptyOptionsSchema
  }
];

export const ENTITY_DRAWER_SLOTS: EntityDrawerCatalog['slots'] = ENTITY_DRAWER_SLOT_DEFINITIONS.map(
  definition => ({
    id: definition.id,
    label: definition.label,
    description: definition.description,
    application: definition.application,
    ...(definition.fixedPresentation ? { fixedPresentation: definition.fixedPresentation } : {}),
    supportedSchemaIds: [],
    defaultOptions: definition.defaultOptions,
    optionFields: definition.optionFields
  })
);

export const getEntityDrawerSlotSchemaIds = (
  schemas: EntityDrawerSchema[],
  capabilityConfigurations: readonly CapabilityConfigurationLike[] = []
): ReadonlyMap<string, string[]> => {
  const schemaIds = new Set(schemas.map(schema => schema.id));
  const result = new Map<string, string[]>();
  for (const definition of ENTITY_DRAWER_SLOT_DEFINITIONS) {
    const binding = definition.capabilityBinding;
    if (!binding) {
      result.set(definition.id, [...schemaIds]);
      continue;
    }
    const configuration = capabilityConfigurations.find(
      candidate => candidate.type === binding.capabilityType
    );
    const schemaId = configuration?.bindings[binding.role]?.target;
    if (schemaId?.kind !== 'entity_schema' || !schemaIds.has(schemaId.id)) continue;
    result.set(definition.id, [...(result.get(definition.id) ?? []), schemaId.id]);
  }
  return result;
};

const getDefaultProviderItems = (
  schemas: EntityDrawerSchema[],
  schemaId: string,
  capabilityConfigurations: readonly CapabilityConfigurationLike[]
): EntityDrawerItem[] => {
  const supported = getEntityDrawerSlotSchemaIds(schemas, capabilityConfigurations);
  const items: EntityDrawerItem[] = [];
  for (const definition of ENTITY_DRAWER_SLOT_DEFINITIONS) {
    // Generic slots are available from the drawer editor but are opt-in for schemas. Built-in
    // application profiles add the generic content they own explicitly below.
    if (!definition.capabilityBinding) continue;
    if (!supported.get(definition.id)?.includes(schemaId)) continue;
    const options = definition.defaultOptions;
    items.push({
      kind: 'slot',
      slotId: definition.id,
      ...(Object.keys(options).length > 0 ? { options } : {})
    });
  }
  return items;
};

/**
 * Seeds generic `rollup`/`rollup-leaf-count` drawer items for a Business Capability schema from
 * the Strategy view config's `field.rollup` markers — the same fields the Capabilities table rolls
 * up. This only affects freshly-generated default profiles; once a workspace saves its own drawer
 * profile, roll-up items live directly in that profile like any other item.
 */
const getStrategyRollupItems = (
  schema: EntityDrawerSchema | undefined,
  capabilityConfigurations: readonly CapabilityConfigurationLike[]
): EntityDrawerItem[] => {
  if (!schema) return [];
  const configuration = capabilityConfigurations.find(
    candidate => candidate.type === 'strategy-model'
  );
  const boundSchemaId = configuration?.bindings['business_capability']?.target;
  if (boundSchemaId?.kind !== 'entity_schema' || boundSchemaId.id !== schema.id) return [];
  const supportsSubtreeRollup = schema.fields.some(
    candidate => candidate.id === 'parent' && candidate.type === 'containment'
  );
  if (!supportsSubtreeRollup) return [];
  const parsed = strategyModelViewConfigSchema.safeParse(
    configuration?.view_config ?? DEFAULT_STRATEGY_VIEW_CONFIG
  );
  const view = parsed.success ? parsed.data : DEFAULT_STRATEGY_VIEW_CONFIG;
  const rollupItems: EntityDrawerItem[] = view.fields.flatMap(field => {
    if (!field.rollup) return [];
    const target = schema.fields.find(candidate => candidate.id === field.fieldId);
    if (!target || !fieldIsVisible(target) || !['number', 'currency'].includes(target.type)) {
      return [];
    }
    return [
      {
        kind: 'rollup' as const,
        fieldId: field.fieldId,
        aggregation: field.rollup.aggregation,
        format: field.rollup.format
      }
    ];
  });
  return rollupItems.length > 0 ? [...rollupItems, { kind: 'rollup-leaf-count' as const }] : [];
};

/**
 * Seeds the generic `query` drawer item that replaces the old `strategy.realized-by` bespoke slot
 * for a freshly-generated default profile — the flat union of a Business Capability's own and its
 * descendants' `business_capability_supports_entity` links, via a `subtree(parent)` traversal
 * (specs/QUERY_LANGUAGE.md §4). Mirrors `getStrategyRollupItems`'s binding checks; only affects
 * freshly-generated default profiles, not stored ones.
 */
const getStrategyRealizedByItem = (
  schema: EntityDrawerSchema | undefined,
  capabilityConfigurations: readonly CapabilityConfigurationLike[]
): EntityDrawerItem[] => {
  if (!schema) return [];
  const configuration = capabilityConfigurations.find(
    candidate => candidate.type === 'strategy-model'
  );
  const boundSchemaId = configuration?.bindings['business_capability']?.target;
  if (boundSchemaId?.kind !== 'entity_schema' || boundSchemaId.id !== schema.id) return [];
  const supportsSubtreeQuery = schema.fields.some(
    candidate => candidate.id === 'parent' && candidate.type === 'containment'
  );
  if (!supportsSubtreeQuery) return [];
  const relationTarget = configuration?.bindings['business_capability_supports_entity']?.target;
  if (relationTarget?.kind !== 'relation_schema') return [];
  return [
    {
      kind: 'query' as const,
      queryText: `subtree(parent).->"${relationTarget.id}"`,
      label: 'Realized by'
    }
  ];
};

/**
 * Seeds the generic `query` drawer item that replaces the bespoke
 * `strategy.linked-objectives` provider for a freshly-generated default profile. The query
 * follows the bound Objective-to-Business-Capability relation from the current capability to its
 * supporting Objectives.
 */
const getStrategyLinkedObjectivesItem = (
  schema: EntityDrawerSchema | undefined,
  capabilityConfigurations: readonly CapabilityConfigurationLike[]
): EntityDrawerItem[] => {
  if (!schema) return [];
  const configuration = capabilityConfigurations.find(
    candidate => candidate.type === 'strategy-model'
  );
  const businessCapabilityTarget = configuration?.bindings.business_capability?.target;
  const relationTarget = configuration?.bindings.objective_supports_business_capability?.target;
  if (
    businessCapabilityTarget?.kind !== 'entity_schema' ||
    businessCapabilityTarget.id !== schema.id ||
    relationTarget?.kind !== 'relation_schema'
  ) {
    return [];
  }

  return [
    {
      kind: 'query' as const,
      queryText: `<-"${escapeQueryStringLiteral(relationTarget.id)}"`,
      label: 'Linked objectives'
    }
  ];
};

/**
 * Seeds the generic `query` drawer item that replaces the bespoke
 * `strategy.linked-initiatives` provider for a freshly-generated default profile. The query
 * walks from the current Business Capability to its supporting Objectives and then reverses the
 * Initiative `objectives` reference to reach the linked Initiatives.
 */
const getStrategyLinkedInitiativesItem = (
  schema: EntityDrawerSchema | undefined,
  schemas: EntityDrawerSchema[],
  capabilityConfigurations: readonly CapabilityConfigurationLike[]
): EntityDrawerItem[] => {
  if (!schema) return [];
  const configuration = capabilityConfigurations.find(
    candidate => candidate.type === 'strategy-model'
  );
  const businessCapabilityTarget = configuration?.bindings.business_capability?.target;
  const objectiveTarget = configuration?.bindings.objective?.target;
  const initiativeTarget = configuration?.bindings.initiative?.target;
  const relationTarget = configuration?.bindings.objective_supports_business_capability?.target;
  if (
    businessCapabilityTarget?.kind !== 'entity_schema' ||
    businessCapabilityTarget.id !== schema.id ||
    objectiveTarget?.kind !== 'entity_schema' ||
    initiativeTarget?.kind !== 'entity_schema' ||
    relationTarget?.kind !== 'relation_schema'
  ) {
    return [];
  }

  const initiativeSchema = schemas.find(candidate => candidate.id === initiativeTarget.id);
  const objectivesField = initiativeSchema?.fields.find(field => field.id === 'objectives');
  if (
    !initiativeSchema ||
    !objectivesField ||
    !['reference', 'containment'].includes(objectivesField.type) ||
    (objectivesField.schemaId !== undefined && objectivesField.schemaId !== objectiveTarget.id)
  ) {
    return [];
  }

  return [
    {
      kind: 'query' as const,
      queryText: `<-"${escapeQueryStringLiteral(relationTarget.id)}".<-"${escapeQueryStringLiteral(initiativeSchema.name)}".${objectivesField.id}`,
      label: 'Linked initiatives'
    }
  ];
};

export type EntityDrawerField = {
  id: string;
  name: string;
  type: string;
  archived?: boolean;
  groupId?: string;
  schemaId?: string;
  relationSchemaId?: string;
  direction?: 'in' | 'out';
};

export type EntityDrawerSchema = {
  id: string;
  name: string;
  fields: EntityDrawerField[];
  groups?: Array<{ id: string; name: string }>;
};

const fieldIsVisible = (field: EntityDrawerField): boolean => field.archived !== true;
const isRelationField = (field: EntityDrawerField): boolean =>
  field.type === 'reference' || field.type === 'containment' || field.type === 'typedRelation';

const rollupFieldIsValid = (field: EntityDrawerField | undefined): boolean =>
  field !== undefined &&
  fieldIsVisible(field) &&
  (field.type === 'number' || field.type === 'currency');

const relationEndpointAllowsSchema = (
  endpoint: RelationSchema['in'] | RelationSchema['out'],
  schemaId: string
): boolean => endpoint.schemaIds === 'any' || endpoint.schemaIds.includes(schemaId);

const validateRollupTraversal = ({
  item,
  currentSchema,
  sourceSchema,
  schemas,
  relationSchemas
}: {
  item: Extract<EntityDrawerItem, { kind: 'rollup' }>;
  currentSchema: EntityDrawerSchema;
  sourceSchema: EntityDrawerSchema | undefined;
  schemas: EntityDrawerSchema[];
  relationSchemas: EntityDrawerRelationSchema[];
}): string | null => {
  if (!item.traversal) {
    if (item.sourceSchemaId !== undefined) {
      return 'A roll-up source schema requires a traversal.';
    }
    if (!rollupFieldIsValid(currentSchema.fields.find(field => field.id === item.fieldId))) {
      return null;
    }
    return null;
  }
  if (!sourceSchema || !item.sourceSchemaId) {
    return 'A relation roll-up must identify an existing source schema.';
  }

  const step = item.traversal;
  if (step.kind === 'relation') {
    if (step.direction === 'forward') {
      const field = currentSchema.fields.find(candidate => candidate.id === step.fieldId);
      if (
        !field ||
        !fieldIsVisible(field) ||
        !['reference', 'containment'].includes(field.type) ||
        field.schemaId !== item.sourceSchemaId ||
        (step.ownerSchemaId !== undefined && step.ownerSchemaId !== currentSchema.id)
      ) {
        return 'The roll-up relation does not point from the current schema to its source schema.';
      }
      return null;
    }

    const owner = schemas.find(
      candidate => candidate.id === (step.ownerSchemaId ?? item.sourceSchemaId)
    );
    const field = owner?.fields.find(candidate => candidate.id === step.fieldId);
    if (
      !owner ||
      owner.id !== item.sourceSchemaId ||
      !field ||
      !fieldIsVisible(field) ||
      !['reference', 'containment'].includes(field.type) ||
      field.schemaId !== currentSchema.id
    ) {
      return 'The backward roll-up relation must be owned by the source schema and target the current schema.';
    }
    return null;
  }

  if (step.kind === 'typedRelation') {
    const field = currentSchema.fields.find(candidate => candidate.id === step.fieldId);
    const relationSchema = relationSchemas.find(
      candidate => candidate.id === step.relationSchemaId
    );
    const targetEndpoint = step.direction === 'in' ? relationSchema?.out : relationSchema?.in;
    if (
      !field ||
      !fieldIsVisible(field) ||
      field.type !== 'typedRelation' ||
      field.relationSchemaId !== step.relationSchemaId ||
      field.direction !== step.direction ||
      !relationSchema ||
      !targetEndpoint ||
      !relationEndpointAllowsSchema(targetEndpoint, item.sourceSchemaId)
    ) {
      return 'The typed relation roll-up does not point to its source schema.';
    }
    return null;
  }

  const relationSchema = relationSchemas.find(candidate => candidate.id === step.relationSchemaId);
  const currentAtIn = relationSchema
    ? relationEndpointAllowsSchema(relationSchema.in, currentSchema.id)
    : false;
  const currentAtOut = relationSchema
    ? relationEndpointAllowsSchema(relationSchema.out, currentSchema.id)
    : false;
  const sourceAllowed = (endpoint: RelationSchema['in'] | RelationSchema['out']) =>
    relationEndpointAllowsSchema(endpoint, item.sourceSchemaId!);
  const validDirection =
    step.direction === 'both'
      ? (currentAtIn || currentAtOut) &&
        (sourceAllowed(relationSchema?.in ?? { schemaIds: [] }) ||
          sourceAllowed(relationSchema?.out ?? { schemaIds: [] }))
      : step.direction === 'in'
        ? currentAtIn && sourceAllowed(relationSchema?.out ?? { schemaIds: [] })
        : currentAtOut && sourceAllowed(relationSchema?.in ?? { schemaIds: [] });
  return relationSchema && validDirection
    ? null
    : 'The unbound typed relation roll-up does not point to its source schema.';
};

/**
 * Converts the pre-built-in Strategy children slot while reading old stored configurations. This
 * intentionally happens before schema parsing so workspaces do not need a data migration.
 */
export const normalizeLegacyEntityDrawerConfiguration = (raw: unknown): unknown => {
  if (!raw || typeof raw !== 'object' || !('profiles' in raw)) return raw;
  const profiles = raw.profiles;
  if (!profiles || typeof profiles !== 'object') return raw;

  return {
    ...raw,
    profiles: Object.fromEntries(
      Object.entries(profiles).map(([schemaId, profile]) => {
        if (!profile || typeof profile !== 'object' || !('sections' in profile)) {
          return [schemaId, profile];
        }
        const sections = profile.sections;
        if (!Array.isArray(sections)) return [schemaId, profile];
        return [
          schemaId,
          {
            ...profile,
            sections: sections.map(section => {
              if (!section || typeof section !== 'object' || !('items' in section)) return section;
              const items = section.items;
              if (!Array.isArray(items)) return section;
              return {
                ...section,
                items: items.flatMap(item => {
                  if (!item || typeof item !== 'object' || item.kind !== 'slot') {
                    return [item];
                  }
                  if (item.slotId === 'vendor.capabilities-funded') {
                    return [
                      {
                        kind: 'placeholder',
                        message: VENDOR_CAPABILITIES_FUNDED_PLACEHOLDER_MESSAGE
                      }
                    ];
                  }
                  if (item.slotId === 'strategy.children') {
                    return [
                      {
                        kind: 'children',
                        childSchemaId: schemaId,
                        fieldId: 'parent',
                        ...('label' in item && typeof item.label === 'string'
                          ? { label: item.label }
                          : {})
                      }
                    ];
                  }
                  if (item.slotId === 'data-stewardship.change-cases') {
                    return [{ ...item, slotId: 'entity.change-cases' }];
                  }
                  return [normalizeFixedPresentationSlotItem(item)];
                })
              };
            })
          }
        ];
      })
    )
  };
};

const fixedPresentationForSlot = (slotId: string): 'row' | 'mini-panel' | undefined =>
  ENTITY_DRAWER_SLOT_DEFINITIONS.find(definition => definition.id === slotId)?.fixedPresentation;

const normalizeFixedPresentationSlotItem = (
  item: Extract<EntityDrawerItem, { kind: 'slot' }>
): Extract<EntityDrawerItem, { kind: 'slot' }> => {
  if (!fixedPresentationForSlot(item.slotId) || item.presentation === undefined) return item;
  const { presentation: _presentation, ...withoutPresentation } = item;
  return withoutPresentation;
};

export const resolveEntityDrawerSlotItemPresentation = (
  item: Extract<EntityDrawerItem, { kind: 'slot' }>
): Extract<EntityDrawerItem, { kind: 'slot' }> => {
  const fixedPresentation = fixedPresentationForSlot(item.slotId);
  return fixedPresentation ? { ...item, presentation: fixedPresentation } : item;
};

const fieldItem = (
  field: EntityDrawerField,
  presentation?: 'row' | 'mini-panel'
): EntityDrawerItem => {
  const resolvedPresentation =
    presentation ?? (field.type === 'typedRelation' ? 'mini-panel' : undefined);
  return isRelationField(field)
    ? {
        kind: 'relation',
        fieldId: field.id,
        ...(resolvedPresentation ? { presentation: resolvedPresentation } : {})
      }
    : {
        kind: 'field',
        fieldId: field.id,
        ...(resolvedPresentation ? { presentation: resolvedPresentation } : {})
      };
};

type BusinessGlossaryFieldIds = {
  definition: string;
  synonyms: string;
  abbreviations: string;
  categories: string;
  status: string;
};

const businessGlossaryFieldIds = (
  schema: EntityDrawerSchema,
  capabilityConfigurations: readonly CapabilityConfigurationLike[]
): BusinessGlossaryFieldIds | null => {
  const configuration = capabilityConfigurations.find(
    candidate => candidate.type === 'business-glossary'
  );
  const binding = configuration?.bindings.term;
  if (binding?.target.kind !== 'entity_schema' || binding.target.id !== schema.id) {
    return null;
  }

  const role = businessGlossaryCapabilityDefinition.bindingRoles.find(item => item.id === 'term');
  if (!role) return null;

  const fieldIdFor = (roleId: keyof BusinessGlossaryFieldIds) => {
    const fieldRole = role.fieldRoles.find(field => field.id === roleId);
    return fieldRole ? resolveCapabilityFieldId(binding, fieldRole) : null;
  };
  const definition = fieldIdFor('definition');
  const synonyms = fieldIdFor('synonyms');
  const abbreviations = fieldIdFor('abbreviations');
  const categories = fieldIdFor('categories');
  const status = fieldIdFor('status');
  if (!definition || !synonyms || !abbreviations || !categories || !status) return null;

  const fieldIds = { definition, synonyms, abbreviations, categories, status };
  const fields = Object.values(fieldIds).map(fieldId =>
    schema.fields.find(field => field.id === fieldId && fieldIsVisible(field))
  );
  if (fields.some(field => field === undefined)) return null;

  const categoriesField = schema.fields.find(field => field.id === fieldIds.categories);
  if (!categoriesField || !isRelationField(categoriesField)) return null;

  return fieldIds;
};

const buildBusinessGlossaryDefaultProfile = (
  providerItems: EntityDrawerItem[],
  fieldIds: BusinessGlossaryFieldIds
): EntityDrawerProfile => {
  const item = (fieldId: string, kind: 'field' | 'relation' = 'field'): EntityDrawerItem => ({
    kind,
    fieldId
  });
  const usageItems = providerItems.map(providerItem =>
    providerItem.kind === 'slot' && providerItem.slotId === 'entity.usage'
      ? { ...providerItem, label: 'Usage & backlinks' }
      : providerItem
  );

  return {
    header: {
      badges: [
        { kind: 'field', fieldId: fieldIds.status, showLabel: false },
        { kind: 'metadata', slot: 'lifecycle' }
      ]
    },
    sections: [
      {
        id: 'attributes',
        title: 'Attributes',
        collapsible: false,
        items: [item(fieldIds.definition), item(fieldIds.synonyms), item(fieldIds.abbreviations)]
      },
      {
        id: 'details',
        title: 'Details',
        collapsible: true,
        items: [
          { kind: 'metadata', slot: 'owner' },
          item(fieldIds.categories, 'relation'),
          ...usageItems
        ]
      }
    ]
  };
};

type DataStewardshipFieldIds = {
  classification: string;
  retentionPolicy: string;
  steward: string;
  custodian: string;
  reviewDate: string;
  reviewStatus: string;
  stewardshipStatus: string;
  regulatoryTags: string;
  processingPurposes: string;
  permittedResidencyRegions: string;
};

type ApiSpecificationFieldIds = {
  apiVersion: string;
  protocols: string;
  providers: string;
  consumers: string;
};

const apiSpecificationFieldIds = (
  schema: EntityDrawerSchema,
  capabilityConfigurations: readonly CapabilityConfigurationLike[]
): ApiSpecificationFieldIds | null => {
  const configuration = capabilityConfigurations.find(
    candidate => candidate.type === 'api-specification'
  );
  const binding = configuration?.bindings.api;
  if (binding?.target.kind !== 'entity_schema' || binding.target.id !== schema.id) return null;

  const definition = getWorkspaceCapabilityDefinition('api-specification');
  const apiRole = definition?.bindingRoles.find(role => role.id === 'api');
  const apiVersionRole = apiRole?.fieldRoles.find(role => role.id === 'api_version');
  const apiVersion = apiVersionRole
    ? resolveCapabilityFieldId(binding, apiVersionRole)
    : 'api_version';
  const fieldIds: ApiSpecificationFieldIds = {
    apiVersion,
    protocols: 'protocols',
    providers: 'providers',
    consumers: 'consumers'
  };
  const fields = Object.values(fieldIds).map(fieldId =>
    schema.fields.find(field => field.id === fieldId && fieldIsVisible(field))
  );
  if (fields.some(field => field === undefined)) return null;

  const providerField = schema.fields.find(field => field.id === fieldIds.providers);
  const consumerField = schema.fields.find(field => field.id === fieldIds.consumers);
  if (providerField?.type !== 'typedRelation' || consumerField?.type !== 'typedRelation') {
    return null;
  }
  return fieldIds;
};

const buildApiSpecificationDefaultProfile = (
  providerItems: EntityDrawerItem[],
  fieldIds: ApiSpecificationFieldIds
): EntityDrawerProfile => {
  const provider = (slotId: string): EntityDrawerItem | null => {
    const slot = providerItems.find(
      (candidate): candidate is Extract<EntityDrawerItem, { kind: 'slot' }> =>
        candidate.kind === 'slot' && candidate.slotId === slotId
    );
    return slot ? { ...slot, showLabel: false } : null;
  };
  const section = (
    id: string,
    title: string,
    items: Array<EntityDrawerItem | null>,
    collapsible = false
  ) => ({
    id,
    title,
    collapsible,
    items: items.filter((candidate): candidate is EntityDrawerItem => candidate != null)
  });

  return {
    header: {
      badges: [
        { kind: 'field', fieldId: fieldIds.protocols, showLabel: false },
        { kind: 'metadata', slot: 'lifecycle' }
      ]
    },
    sections: [
      section('attributes', 'Attributes', [
        { kind: 'field', fieldId: fieldIds.apiVersion, label: 'API version' },
        { kind: 'metadata', slot: 'owner' }
      ]),
      section('providers', 'Providers', [
        { kind: 'relation', fieldId: fieldIds.providers, label: 'Providers' }
      ]),
      section('consumers', 'Consumers', [
        { kind: 'relation', fieldId: fieldIds.consumers, label: 'Consumers' }
      ]),
      section('specification', 'Specification', [provider('api-specification.catalog')])
    ].filter(section => section.items.length > 0)
  };
};

const dataStewardshipFieldIds = (
  schema: EntityDrawerSchema,
  capabilityConfigurations: readonly CapabilityConfigurationLike[]
): DataStewardshipFieldIds | null => {
  const configuration = capabilityConfigurations.find(
    candidate => candidate.type === 'data-stewardship'
  );
  const binding = configuration?.bindings.dataEntity;
  if (binding?.target.kind !== 'entity_schema' || binding.target.id !== schema.id) return null;

  const fieldIds: DataStewardshipFieldIds = {
    classification: 'classification',
    retentionPolicy: 'retention_policy',
    steward: 'steward',
    custodian: 'custodian',
    reviewDate: 'review_date',
    reviewStatus: 'review_status',
    stewardshipStatus: 'stewardship_status',
    regulatoryTags: 'regulatory_tags',
    processingPurposes: 'processing_purposes',
    permittedResidencyRegions: 'permitted_residency_regions'
  };

  const fields = Object.values(fieldIds).map(fieldId =>
    schema.fields.find(field => field.id === fieldId && fieldIsVisible(field))
  );
  if (fields.some(field => field === undefined)) return null;

  const retentionPolicy = schema.fields.find(field => field.id === fieldIds.retentionPolicy);
  if (!retentionPolicy || !isRelationField(retentionPolicy)) return null;

  return fieldIds;
};

const buildDataStewardshipDefaultProfile = (
  providerItems: EntityDrawerItem[],
  fieldIds: DataStewardshipFieldIds
): EntityDrawerProfile => {
  const field = (
    fieldId: string,
    kind: 'field' | 'relation' = 'field',
    presentation?: 'row' | 'mini-panel'
  ): EntityDrawerItem => ({
    kind,
    fieldId,
    ...(presentation ? { presentation } : {})
  });
  const provider = (slotId: string): EntityDrawerItem | null => {
    const slot = providerItems.find(
      (candidate): candidate is Extract<EntityDrawerItem, { kind: 'slot' }> =>
        candidate.kind === 'slot' && candidate.slotId === slotId
    );
    return slot ? { ...slot, showLabel: false } : null;
  };
  const section = (
    id: string,
    title: string,
    items: Array<EntityDrawerItem | null>,
    collapsible = false
  ) => ({
    id,
    title,
    collapsible,
    items: items.filter((candidate): candidate is EntityDrawerItem => candidate != null)
  });

  return {
    header: {
      badges: [{ kind: 'field', fieldId: fieldIds.classification, showLabel: false }]
    },
    sections: [
      section('attributes', 'Attributes', [
        field(fieldIds.classification),
        field(fieldIds.retentionPolicy, 'relation', 'mini-panel')
      ]),
      section('stewardship', 'Stewardship', [
        { kind: 'metadata', slot: 'owner' },
        field(fieldIds.steward),
        field(fieldIds.custodian),
        field(fieldIds.reviewDate),
        field(fieldIds.reviewStatus),
        field(fieldIds.stewardshipStatus),
        field(fieldIds.regulatoryTags),
        field(fieldIds.processingPurposes),
        field(fieldIds.permittedResidencyRegions)
      ]),
      section('queue-items', 'Queue items', [provider('entity.governance-items')], true),
      section('cases', 'Cases', [provider('entity.change-cases')], true),
      section('assessments', 'Assessments', [provider('entity.assessments')], true)
    ].filter(section => section.items.length > 0)
  };
};

type VendorManagementFieldIds = {
  category: string;
  tier: string;
  status: string;
  relationshipOwner: string;
  costCentre: string;
  securityRisk: string;
  concentrationRisk: string;
  financialRisk: string;
  complianceRisk: string;
  criticality: string;
};

const vendorManagementFieldIds = (
  schema: EntityDrawerSchema,
  capabilityConfigurations: readonly CapabilityConfigurationLike[]
): VendorManagementFieldIds | null => {
  const configuration = capabilityConfigurations.find(
    candidate => candidate.type === 'vendor-management'
  );
  const binding = configuration?.bindings.vendor;
  if (binding?.target.kind !== 'entity_schema' || binding.target.id !== schema.id) return null;

  const fieldIds: VendorManagementFieldIds = {
    category: 'category',
    tier: 'tier',
    status: 'status',
    relationshipOwner: 'relationship_owner',
    costCentre: 'cost_centre',
    securityRisk: 'security_risk',
    concentrationRisk: 'concentration_risk',
    financialRisk: 'financial_risk',
    complianceRisk: 'compliance_risk',
    criticality: 'criticality'
  };
  return Object.values(fieldIds).every(fieldId =>
    schema.fields.some(field => field.id === fieldId && fieldIsVisible(field))
  )
    ? fieldIds
    : null;
};

const vendorManagementSpendRollupItems = (
  vendorSchema: EntityDrawerSchema,
  schemas: EntityDrawerSchema[],
  capabilityConfigurations: readonly CapabilityConfigurationLike[]
): EntityDrawerItem[] => {
  const configuration = capabilityConfigurations.find(
    candidate => candidate.type === 'vendor-management'
  );
  const vendorBinding = configuration?.bindings.vendor;
  const contractBinding = configuration?.bindings.contract;
  if (
    vendorBinding?.target.kind !== 'entity_schema' ||
    vendorBinding.target.id !== vendorSchema.id ||
    contractBinding?.target.kind !== 'entity_schema'
  ) {
    return [];
  }

  const contractSchema = schemas.find(schema => schema.id === contractBinding.target.id);
  const vendorField = contractSchema?.fields.find(field => field.id === 'vendor');
  const annualCostField = contractSchema?.fields.find(field => field.id === 'annual_cost');
  if (
    !contractSchema ||
    !vendorField ||
    !isRelationField(vendorField) ||
    annualCostField === undefined ||
    !fieldIsVisible(annualCostField) ||
    !['number', 'currency'].includes(annualCostField.type)
  ) {
    return [];
  }

  const traversal = {
    kind: 'relation' as const,
    fieldId: vendorField.id,
    direction: 'backward' as const,
    ownerSchemaId: contractSchema.id
  };
  return [
    {
      kind: 'rollup' as const,
      sourceSchemaId: contractSchema.id,
      fieldId: annualCostField.id,
      traversal,
      aggregation: 'sum' as const,
      format: 'currency' as const,
      label: 'vmSpend'
    },
    {
      kind: 'rollup' as const,
      sourceSchemaId: contractSchema.id,
      fieldId: annualCostField.id,
      traversal,
      aggregation: 'count' as const,
      format: 'number' as const,
      label: 'Contracts'
    }
  ];
};

const buildVendorManagementDefaultProfile = (
  providerItems: EntityDrawerItem[],
  fieldIds: VendorManagementFieldIds,
  contractsQueryItem: Extract<EntityDrawerItem, { kind: 'query' }> | null,
  applicationsSuppliedQueryItem: Extract<EntityDrawerItem, { kind: 'query' }> | null,
  spendRollupItems: EntityDrawerItem[]
): EntityDrawerProfile => {
  const item = (fieldId: string): Extract<EntityDrawerItem, { kind: 'field' }> => ({
    kind: 'field',
    fieldId
  });
  const provider = (slotId: string, label: string, showLabel = true): EntityDrawerItem | null => {
    const slot = providerItems.find(
      (candidate): candidate is Extract<EntityDrawerItem, { kind: 'slot' }> =>
        candidate.kind === 'slot' && candidate.slotId === slotId
    );
    return slot
      ? {
          ...slot,
          label,
          ...(showLabel ? {} : { showLabel: false })
        }
      : null;
  };
  const section = (
    id: string,
    title: string,
    items: Array<EntityDrawerItem | null>,
    collapsible = false
  ) => ({
    id,
    title,
    collapsible,
    items: items.filter((candidate): candidate is EntityDrawerItem => candidate != null)
  });

  return {
    header: {
      badges: [
        { kind: 'field', fieldId: fieldIds.tier, showLabel: false },
        { kind: 'field', fieldId: fieldIds.status, showLabel: false }
      ]
    },
    sections: [
      {
        ...section('risk-profile', 'Risk profile', [
          { ...item(fieldIds.securityRisk), presentation: 'mini-panel' },
          { ...item(fieldIds.concentrationRisk), presentation: 'mini-panel' },
          { ...item(fieldIds.financialRisk), presentation: 'mini-panel' },
          { ...item(fieldIds.complianceRisk), presentation: 'mini-panel' },
          { ...item(fieldIds.criticality), presentation: 'mini-panel' }
        ]),
        layout: 'stat-grid' as const
      },
      section('attributes', 'Attributes', [
        item(fieldIds.category),
        item(fieldIds.tier),
        item(fieldIds.status),
        item(fieldIds.relationshipOwner),
        item(fieldIds.costCentre)
      ]),
      {
        ...section('spend', 'Spend', spendRollupItems, true),
        layout: 'stat-grid' as const
      },
      section('contracts', 'Contracts', [contractsQueryItem], true),
      section(
        'applications-supplied',
        'Applications supplied',
        [applicationsSuppliedQueryItem],
        true
      ),
      section(
        'technology-lifecycle',
        'Technology lifecycle',
        [provider('vendor.technology-lifecycle', 'Technology lifecycle', false)],
        true
      ),
      section(
        'capabilities-funded',
        'Capabilities funded',
        [{ kind: 'placeholder', message: VENDOR_CAPABILITIES_FUNDED_PLACEHOLDER_MESSAGE }],
        true
      )
    ].filter(section => section.items.length > 0)
  };
};

type VendorManagementContractFieldIds = {
  vendor: string;
  contractStart: string;
  contractEnd: string;
  contractType: string;
  noticePeriodDays: string;
  autoRenew: string;
  contractOwner: string;
  annualCost: string;
  setupFee: string;
  system: string;
};

const vendorManagementContractFieldIds = (
  schema: EntityDrawerSchema,
  capabilityConfigurations: readonly CapabilityConfigurationLike[]
): VendorManagementContractFieldIds | null => {
  const configuration = capabilityConfigurations.find(
    candidate => candidate.type === 'vendor-management'
  );
  const binding = configuration?.bindings.contract;
  if (binding?.target.kind !== 'entity_schema' || binding.target.id !== schema.id) return null;

  const fieldIds: VendorManagementContractFieldIds = {
    vendor: 'vendor',
    contractStart: 'contract_start',
    contractEnd: 'contract_end',
    contractType: 'contract_type',
    noticePeriodDays: 'notice_period_days',
    autoRenew: 'auto_renew',
    contractOwner: 'contract_owner',
    annualCost: 'annual_cost',
    setupFee: 'setup_fee',
    system: 'system'
  };
  const fields = Object.values(fieldIds).map(fieldId =>
    schema.fields.find(field => field.id === fieldId && fieldIsVisible(field))
  );
  if (fields.some(field => field === undefined)) return null;

  const vendorField = schema.fields.find(field => field.id === fieldIds.vendor);
  const systemField = schema.fields.find(field => field.id === fieldIds.system);
  if (!vendorField || !isRelationField(vendorField)) return null;
  if (systemField?.type !== 'typedRelation') return null;

  return fieldIds;
};

const escapeQueryStringLiteral = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

const vendorManagementContractsQueryItem = (
  vendorSchema: EntityDrawerSchema,
  schemas: EntityDrawerSchema[],
  capabilityConfigurations: readonly CapabilityConfigurationLike[]
): Extract<EntityDrawerItem, { kind: 'query' }> | null => {
  const configuration = capabilityConfigurations.find(
    candidate => candidate.type === 'vendor-management'
  );
  const vendorBinding = configuration?.bindings.vendor;
  const contractBinding = configuration?.bindings.contract;
  if (
    vendorBinding?.target.kind !== 'entity_schema' ||
    vendorBinding.target.id !== vendorSchema.id ||
    contractBinding?.target.kind !== 'entity_schema'
  ) {
    return null;
  }

  const contractSchema = schemas.find(schema => schema.id === contractBinding.target.id);
  if (!contractSchema) return null;

  const vendorField = contractSchema.fields.find(field => field.id === 'vendor');
  if (!vendorField || !isRelationField(vendorField)) return null;

  return {
    kind: 'query',
    queryText: `<-"${escapeQueryStringLiteral(contractSchema.name)}".${vendorField.id}`,
    label: 'Contracts',
    showLabel: false,
    presentation: 'list',
    fields: [{ fieldId: 'annual_cost', label: 'Annual cost' }]
  };
};

const vendorManagementApplicationsSuppliedQueryItem = (
  vendorSchema: EntityDrawerSchema,
  schemas: EntityDrawerSchema[],
  capabilityConfigurations: readonly CapabilityConfigurationLike[]
): Extract<EntityDrawerItem, { kind: 'query' }> | null => {
  const configuration = capabilityConfigurations.find(
    candidate => candidate.type === 'vendor-management'
  );
  const vendorBinding = configuration?.bindings.vendor;
  const contractBinding = configuration?.bindings.contract;
  if (
    vendorBinding?.target.kind !== 'entity_schema' ||
    vendorBinding.target.id !== vendorSchema.id ||
    contractBinding?.target.kind !== 'entity_schema'
  ) {
    return null;
  }

  const contractSchema = schemas.find(schema => schema.id === contractBinding.target.id);
  const vendorField = contractSchema?.fields.find(field => field.id === 'vendor');
  const systemField = contractSchema?.fields.find(field => field.id === 'system');
  if (
    !contractSchema ||
    !vendorField ||
    !isRelationField(vendorField) ||
    systemField?.type !== 'typedRelation' ||
    !systemField.relationSchemaId
  ) {
    return null;
  }

  return {
    kind: 'query',
    queryText: `<-"${escapeQueryStringLiteral(contractSchema.name)}".${vendorField.id}.<-"${escapeQueryStringLiteral(systemField.relationSchemaId)}"`,
    label: 'Applications supplied'
  };
};

const buildVendorManagementContractDefaultProfile = (
  fieldIds: VendorManagementContractFieldIds
): EntityDrawerProfile => {
  const field = (
    fieldId: string,
    presentation?: 'row' | 'mini-panel'
  ): Extract<EntityDrawerItem, { kind: 'field' }> => ({
    kind: 'field',
    fieldId,
    ...(presentation ? { presentation } : {})
  });
  const relation = (fieldId: string, label: string): EntityDrawerItem => ({
    kind: 'relation',
    fieldId,
    label
  });
  const section = (
    id: string,
    title: string,
    items: Array<EntityDrawerItem | null>,
    collapsible = false
  ) => ({
    id,
    title,
    collapsible,
    items: items.filter((candidate): candidate is EntityDrawerItem => candidate != null)
  });

  return {
    header: {
      badges: [{ kind: 'field', fieldId: fieldIds.contractType, showLabel: false }]
    },
    sections: [
      section('vendor', 'Vendor', [relation(fieldIds.vendor, 'Provided by')]),
      section('terms', 'Terms', [
        field(fieldIds.contractStart),
        field(fieldIds.contractEnd),
        field(fieldIds.contractType),
        field(fieldIds.noticePeriodDays),
        field(fieldIds.autoRenew),
        field(fieldIds.contractOwner)
      ]),
      {
        ...section('cost', 'Cost', [
          field(fieldIds.annualCost, 'mini-panel'),
          field(fieldIds.setupFee, 'mini-panel')
        ]),
        layout: 'stat-grid' as const
      },
      section(
        'systems-used',
        'Systems used',
        [
          {
            kind: 'typed-relation-list',
            fieldId: fieldIds.system,
            label: 'Systems used',
            showLabel: false
          }
        ],
        true
      )
    ].filter(section => section.items.length > 0)
  };
};

export const buildDefaultEntityDrawerProfile = (
  schema: EntityDrawerSchema,
  providerItems: EntityDrawerItem[] = []
): EntityDrawerProfile => {
  const fields = schema.fields.filter(fieldIsVisible);
  const groups = (schema.groups ?? []).map(group => ({
    id: `group:${group.id}`,
    title: group.name,
    collapsible: true,
    items: fields
      .filter(field => field.groupId === group.id && !isRelationField(field))
      .map(field => fieldItem(field))
  }));
  const ungrouped = fields
    .filter(field => !field.groupId && !isRelationField(field))
    .map(field => fieldItem(field));
  const typedRelationItems: EntityDrawerItem[] = fields
    .filter(field => field.type === 'typedRelation')
    .map(field => ({ kind: 'typed-relation-list', fieldId: field.id }));
  const relationItems = fields
    .filter(field => isRelationField(field) && field.type !== 'typedRelation')
    .map(field => fieldItem(field));
  const sections = [
    ...(ungrouped.length > 0
      ? [{ id: 'attributes', title: 'Attributes', collapsible: false, items: ungrouped }]
      : []),
    ...groups.filter(group => group.items.length > 0),
    ...(relationItems.length > 0
      ? [{ id: 'related', title: 'Related entities', collapsible: true, items: relationItems }]
      : []),
    ...(typedRelationItems.length > 0
      ? [
          {
            id: 'typed-relations',
            title: 'Related data',
            showTitle: false,
            collapsible: false,
            items: typedRelationItems
          }
        ]
      : []),
    {
      id: 'metadata',
      title: 'Details',
      collapsible: true,
      items: ENTITY_DRAWER_METADATA_SLOTS.map(slot => ({
        kind: 'metadata' as const,
        slot: slot.id
      }))
    },
    ...(providerItems.length > 0
      ? [
          {
            id: 'application-content',
            title: 'Application content',
            collapsible: true,
            items: providerItems
          }
        ]
      : [])
  ];
  return { header: { badges: [] }, sections };
};

/**
 * Builds the generic drawer used when a workspace has no stored drawer profile.
 *
 * This deliberately mirrors the schema-driven part of the entity overview: fields stay in
 * schema order, grouped fields stay inside their schema field groups, and metadata is shown in a
 * separate details section. Application-specific profiles and provider slots are authored in
 * seed/template/workspace configuration instead of being inferred here.
 */
export const buildFallbackEntityDrawerProfile = (
  schema: EntityDrawerSchema
): EntityDrawerProfile => {
  const fields = schema.fields.filter(fieldIsVisible);
  const groups = (schema.groups ?? []).map(group => ({
    id: `group:${group.id}`,
    title: group.name,
    collapsible: false,
    items: fields.filter(field => field.groupId === group.id).map(field => fieldItem(field))
  }));
  const ungrouped = fields.filter(field => !field.groupId).map(field => fieldItem(field));

  return {
    header: { badges: [] },
    sections: [
      ...(ungrouped.length > 0
        ? [{ id: 'attributes', title: 'Attributes', collapsible: false, items: ungrouped }]
        : []),
      ...groups.filter(group => group.items.length > 0),
      {
        id: 'metadata',
        title: 'Details',
        collapsible: true,
        items: ENTITY_DRAWER_METADATA_SLOTS.map(slot => ({
          kind: 'metadata' as const,
          slot: slot.id
        }))
      }
    ]
  };
};

export const buildFallbackEntityDrawerConfiguration = (
  schemas: EntityDrawerSchema[]
): EntityDrawerConfiguration => ({
  version: 1,
  profiles: Object.fromEntries(
    schemas.map(schema => [schema.id, buildFallbackEntityDrawerProfile(schema)])
  )
});

export const buildDefaultEntityDrawerConfiguration = (
  schemas: EntityDrawerSchema[],
  capabilityConfigurations: readonly CapabilityConfigurationLike[] = []
): EntityDrawerConfiguration => ({
  version: 1,
  profiles: Object.fromEntries(
    schemas.map(schema => {
      const dataStewardshipFieldIdsValue = dataStewardshipFieldIds(
        schema,
        capabilityConfigurations
      );
      const glossaryFieldIds = businessGlossaryFieldIds(schema, capabilityConfigurations);
      const providerItems = [
        ...getStrategyRealizedByItem(schema, capabilityConfigurations),
        ...getStrategyLinkedObjectivesItem(schema, capabilityConfigurations),
        ...getStrategyLinkedInitiativesItem(schema, schemas, capabilityConfigurations),
        ...getDefaultProviderItems(schemas, schema.id, capabilityConfigurations),
        ...(dataStewardshipFieldIdsValue
          ? [{ kind: 'slot' as const, slotId: 'entity.change-cases' }]
          : []),
        ...(dataStewardshipFieldIdsValue
          ? [{ kind: 'slot' as const, slotId: 'entity.governance-items' }]
          : []),
        ...(dataStewardshipFieldIdsValue
          ? [{ kind: 'slot' as const, slotId: 'entity.assessments' }]
          : []),
        ...(glossaryFieldIds ? [{ kind: 'slot' as const, slotId: 'entity.usage' }] : []),
        ...getStrategyRollupItems(schema, capabilityConfigurations)
      ];
      const apiSpecificationFieldIdsValue = apiSpecificationFieldIds(
        schema,
        capabilityConfigurations
      );
      const vendorFieldIds = vendorManagementFieldIds(schema, capabilityConfigurations);
      const contractFieldIds = vendorManagementContractFieldIds(schema, capabilityConfigurations);
      const contractsQueryItem = vendorManagementContractsQueryItem(
        schema,
        schemas,
        capabilityConfigurations
      );
      const applicationsSuppliedQueryItem = vendorManagementApplicationsSuppliedQueryItem(
        schema,
        schemas,
        capabilityConfigurations
      );
      const spendRollupItems = vendorManagementSpendRollupItems(
        schema,
        schemas,
        capabilityConfigurations
      );
      return [
        schema.id,
        glossaryFieldIds
          ? buildBusinessGlossaryDefaultProfile(providerItems, glossaryFieldIds)
          : dataStewardshipFieldIdsValue
            ? buildDataStewardshipDefaultProfile(providerItems, dataStewardshipFieldIdsValue)
            : apiSpecificationFieldIdsValue
              ? buildApiSpecificationDefaultProfile(providerItems, apiSpecificationFieldIdsValue)
              : vendorFieldIds
                ? buildVendorManagementDefaultProfile(
                    providerItems,
                    vendorFieldIds,
                    contractsQueryItem,
                    applicationsSuppliedQueryItem,
                    spendRollupItems
                  )
                : contractFieldIds
                  ? buildVendorManagementContractDefaultProfile(contractFieldIds)
                  : buildDefaultEntityDrawerProfile(schema, providerItems)
      ];
    })
  )
});

const validateItem = (
  item: EntityDrawerItem,
  schema: EntityDrawerSchema,
  schemas: EntityDrawerSchema[],
  relationSchemas: EntityDrawerRelationSchema[],
  schemaId: string,
  sectionId: string,
  diagnostics: EntityDrawerDiagnostic[]
): EntityDrawerItem | null => {
  if (item.kind === 'metadata') return item;
  if (item.kind === 'placeholder') return item;
  if (item.kind === 'query') return item;
  if (item.kind === 'children') {
    const childSchema = schemas.find(candidate => candidate.id === item.childSchemaId);
    const field = childSchema?.fields.find(candidate => candidate.id === item.fieldId);
    const valid =
      childSchema != null &&
      field != null &&
      fieldIsVisible(field) &&
      field.type === 'containment' &&
      field.schemaId === schemaId;
    if (!valid) {
      diagnostics.push({
        code: 'invalid_children_target',
        schemaId,
        sectionId,
        itemId: `${item.childSchemaId}:${item.fieldId}`,
        message: `Drawer children target '${item.childSchemaId}.${item.fieldId}' is missing, archived, or does not contain this schema.`
      });
      return null;
    }
    return item;
  }
  if (item.kind === 'slot') {
    const definition = ENTITY_DRAWER_SLOT_DEFINITIONS.find(slot => slot.id === item.slotId);
    if (!definition) {
      diagnostics.push({
        code: 'unsupported_slot',
        schemaId,
        sectionId,
        itemId: item.slotId,
        message: `Unsupported drawer slot '${item.slotId}'.`
      });
      return null;
    }
    const options = definition.optionsSchema.safeParse(item.options ?? definition.defaultOptions);
    if (!options.success) {
      diagnostics.push({
        code: 'invalid_slot_options',
        schemaId,
        sectionId,
        itemId: item.slotId,
        message: `Invalid options for drawer slot '${item.slotId}'.`
      });
      return null;
    }
    const normalizedOptions = options.data as Record<string, unknown>;
    return { ...item, options: normalizedOptions };
  }
  if (item.kind === 'rollup' || item.kind === 'rollup-leaf-count') {
    if (item.kind === 'rollup' && item.sourceSchemaId && !item.traversal) {
      diagnostics.push({
        code: 'invalid_rollup_traversal',
        schemaId,
        sectionId,
        itemId: item.fieldId,
        message: 'A roll-up source schema requires a traversal.'
      });
      return null;
    }
    if (item.kind === 'rollup' && item.traversal) {
      const sourceSchema = schemas.find(candidate => candidate.id === item.sourceSchemaId);
      const traversalError = validateRollupTraversal({
        item,
        currentSchema: schema,
        sourceSchema,
        schemas,
        relationSchemas
      });
      const sourceField = sourceSchema?.fields.find(field => field.id === item.fieldId);
      if (traversalError) {
        diagnostics.push({
          code: 'invalid_rollup_traversal',
          schemaId,
          sectionId,
          itemId: item.fieldId,
          message: traversalError
        });
        return null;
      }
      if (!rollupFieldIsValid(sourceField)) {
        diagnostics.push({
          code: 'missing_or_archived_field',
          schemaId,
          sectionId,
          itemId: `${item.sourceSchemaId}.${item.fieldId}`,
          message: `Roll-up source field '${item.sourceSchemaId}.${item.fieldId}' is missing, archived, or not numeric.`
        });
        return null;
      }
      return item;
    }
    const supportsSubtreeRollup = schema.fields.some(
      candidate => candidate.id === 'parent' && candidate.type === 'containment'
    );
    if (!supportsSubtreeRollup) {
      diagnostics.push({
        code: 'unsupported_rollup_schema',
        schemaId,
        sectionId,
        itemId: item.kind === 'rollup' ? item.fieldId : item.kind,
        message: `Drawer roll-up requires a 'parent' containment field on '${schemaId}'.`
      });
      return null;
    }
    if (item.kind === 'rollup-leaf-count') return item;
    const field = schema.fields.find(candidate => candidate.id === item.fieldId);
    if (!field || !fieldIsVisible(field) || !['number', 'currency'].includes(field.type)) {
      diagnostics.push({
        code: 'missing_or_archived_field',
        schemaId,
        sectionId,
        itemId: item.fieldId,
        message: `Roll-up field '${item.fieldId}' is missing, archived, or not numeric.`
      });
      return null;
    }
    return item;
  }
  if (item.kind === 'typed-relation-list') {
    const field = schema.fields.find(candidate => candidate.id === item.fieldId);
    if (!field || !fieldIsVisible(field) || field.type !== 'typedRelation') {
      diagnostics.push({
        code: 'missing_relation_field',
        schemaId,
        sectionId,
        itemId: item.fieldId,
        message: `Drawer typed-relation-list field '${item.fieldId}' is missing, archived, or not a typed relation.`
      });
      return null;
    }
    return item;
  }
  const field = schema.fields.find(candidate => candidate.id === item.fieldId);
  if (!field || !fieldIsVisible(field)) {
    diagnostics.push({
      code: item.kind === 'relation' ? 'missing_relation_field' : 'missing_or_archived_field',
      schemaId,
      sectionId,
      itemId: item.fieldId,
      message: `Drawer field '${item.fieldId}' is missing or archived.`
    });
    return null;
  }
  if (item.kind === 'relation' && !isRelationField(field)) {
    diagnostics.push({
      code: 'missing_relation_field',
      schemaId,
      sectionId,
      itemId: item.fieldId,
      message: `Drawer relation '${item.fieldId}' is no longer a relation field.`
    });
    return null;
  }
  return item;
};

export const resolveEntityDrawerConfiguration = (
  raw: unknown,
  schemas: EntityDrawerSchema[],
  capabilityConfigurations: readonly CapabilityConfigurationLike[] = [],
  relationSchemas: EntityDrawerRelationSchema[] = []
): { effective: EntityDrawerConfiguration; diagnostics: EntityDrawerDiagnostic[] } => {
  const defaults = buildFallbackEntityDrawerConfiguration(schemas);
  const supportedSlotSchemaIds = getEntityDrawerSlotSchemaIds(schemas, capabilityConfigurations);
  const diagnostics: EntityDrawerDiagnostic[] = [];
  if (raw === null || raw === undefined) return { effective: defaults, diagnostics };

  const parsed = entityDrawerConfigurationSchema.safeParse(
    normalizeLegacyEntityDrawerConfiguration(raw)
  );
  if (!parsed.success) {
    const version = raw && typeof raw === 'object' && 'version' in raw ? raw.version : undefined;
    diagnostics.push({
      code:
        typeof version === 'number' && version !== 1 ? 'unknown_version' : 'invalid_configuration',
      message:
        typeof version === 'number' && version !== 1
          ? `Unsupported drawer configuration version '${version}'.`
          : 'The stored drawer configuration is invalid.'
    });
    return { effective: defaults, diagnostics };
  }

  const profiles = { ...defaults.profiles };
  for (const [schemaId, profile] of Object.entries(parsed.data.profiles)) {
    const schema = schemas.find(candidate => candidate.id === schemaId);
    if (!schema) {
      diagnostics.push({
        code: 'missing_schema',
        schemaId,
        message: `Schema '${schemaId}' no longer exists.`
      });
      continue;
    }
    const sections = profile.sections.map(section => ({
      ...section,
      items: section.items.flatMap(item => {
        const resolved = validateItem(
          item,
          schema,
          schemas,
          relationSchemas,
          schemaId,
          section.id,
          diagnostics
        );
        if (!resolved) return [];
        if (item.kind === 'slot' && !supportedSlotSchemaIds.get(item.slotId)?.includes(schemaId)) {
          diagnostics.push({
            code: 'unsupported_slot_for_schema',
            schemaId,
            sectionId: section.id,
            itemId: item.slotId,
            message: `Drawer slot '${item.slotId}' is not available for this schema.`
          });
          return [];
        }
        return [
          resolved.kind === 'slot' ? resolveEntityDrawerSlotItemPresentation(resolved) : resolved
        ];
      })
    }));
    const badges = profile.header.badges.filter(badge => {
      if (badge.kind === 'metadata') return true;
      const field = schema.fields.find(candidate => candidate.id === badge.fieldId);
      if (!field || !fieldIsVisible(field)) {
        diagnostics.push({
          code: 'missing_or_archived_field',
          schemaId,
          itemId: badge.fieldId,
          message: `Drawer badge field '${badge.fieldId}' is missing or archived.`
        });
        return false;
      }
      return true;
    });
    profiles[schemaId] = { header: { badges }, sections };
  }
  return { effective: { version: 1, profiles }, diagnostics };
};

export const buildEntityDrawerCatalog = (
  schemas: EntityDrawerSchema[],
  capabilityConfigurations: readonly CapabilityConfigurationLike[] = []
): EntityDrawerCatalog => {
  const supportedSlotSchemaIds = getEntityDrawerSlotSchemaIds(schemas, capabilityConfigurations);
  return {
    schemas: schemas.map(schema => ({
      id: schema.id,
      name: schema.name,
      fields: schema.fields.map(field => ({
        id: field.id,
        name: field.name,
        type: field.type,
        archived: field.archived === true,
        groupId: field.groupId ?? null,
        ...(field.schemaId !== undefined ? { schemaId: field.schemaId } : {})
      }))
    })),
    metadataSlots: ENTITY_DRAWER_METADATA_SLOTS,
    slots: ENTITY_DRAWER_SLOT_DEFINITIONS.filter(definition => {
      const binding = definition.capabilityBinding;
      return !binding || (supportedSlotSchemaIds.get(definition.id)?.length ?? 0) > 0;
    }).map(definition => ({
      id: definition.id,
      label: definition.label,
      description: definition.description,
      application: definition.application,
      ...(definition.fixedPresentation ? { fixedPresentation: definition.fixedPresentation } : {}),
      supportedSchemaIds: supportedSlotSchemaIds.get(definition.id) ?? [],
      defaultOptions: definition.defaultOptions,
      optionFields: definition.optionFields
    }))
  };
};
