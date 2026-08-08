export type AutomationRuleResourceType = 'entity' | 'relation';
export type AutomationRuleSchema = { fields: Array<{ id: string }> };
type AutomationRuleSchemaWithFieldTypes = {
  fields: Array<{ id: string; type?: string; resultType?: string }>;
};

// These fields are materialized by the audit flatteners and are therefore valid read-only
// automation references even though they are not present in schema.fields.
const ENTITY_PSEUDO_FIELD_IDS = new Set([
  '_schemaId',
  '_name',
  '_slug',
  '_namespace',
  '_description',
  '_owner',
  '_lifecycle',
  '_targetLifecycle',
  '_targetLifecycleDate',
  '_tags',
  '_links',
  '_projectId'
]);

const RELATION_PSEUDO_FIELD_IDS = new Set([
  '_schemaId',
  '_inEntityId',
  '_outEntityId',
  '_owner',
  '_lifecycle'
]);

export const isAutomationPseudoField = (
  resourceType: AutomationRuleResourceType,
  fieldId: string
) => (resourceType === 'entity' ? ENTITY_PSEUDO_FIELD_IDS : RELATION_PSEUDO_FIELD_IDS).has(fieldId);

export const isAutomationReadFieldKnown = (
  resourceType: AutomationRuleResourceType,
  schema: AutomationRuleSchema | null | undefined,
  fieldId: string
) =>
  isAutomationPseudoField(resourceType, fieldId) ||
  (schema?.fields.some(field => field.id === fieldId) ?? false);

export const isAutomationWriteFieldKnown = (
  schema: AutomationRuleSchema | null | undefined,
  fieldId: string
) => schema?.fields.some(field => field.id === fieldId) ?? false;

export const isAutomationReadFieldKnownAcrossSchemas = (
  resourceType: AutomationRuleResourceType,
  schemas: AutomationRuleSchema[],
  fieldId: string
) =>
  isAutomationPseudoField(resourceType, fieldId) ||
  (schemas.length > 0 &&
    schemas.every(schema => isAutomationReadFieldKnown(resourceType, schema, fieldId)));

export const isAutomationWriteFieldKnownAcrossSchemas = (
  schemas: AutomationRuleSchema[],
  fieldId: string
) => schemas.length > 0 && schemas.every(schema => isAutomationWriteFieldKnown(schema, fieldId));

/** The four numeric comparison operators (`greater_than`, etc.) are only meaningful for `number`
 *  and `currency` fields, and `derived` fields whose `resultType` is `number` or `rating` — every
 *  other field type (including pseudo-fields, which never appear in `schema.fields`) is rejected.
 *  A field is treated as numeric-comparable only if every schema that declares it agrees. */
export const isAutomationNumericComparableField = (
  schemas: AutomationRuleSchemaWithFieldTypes[],
  fieldId: string
) =>
  schemas.length > 0 &&
  schemas.every(schema => {
    const field = schema.fields.find(f => f.id === fieldId);
    if (!field) return false;
    if (field.type === 'number' || field.type === 'currency') return true;
    return (
      field.type === 'derived' && (field.resultType === 'number' || field.resultType === 'rating')
    );
  });
