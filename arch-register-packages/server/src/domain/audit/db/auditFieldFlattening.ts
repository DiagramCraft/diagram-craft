import { Entity } from '../../catalog/db/catalogDatabase';

/**
 * Flattens core entity fields with `_` prefixes (`_lifecycle`, `_targetLifecycle`, `_owner`,
 * etc.) plus spreads `entity.data` (custom schema fields). This is the shape audit log
 * `changes.old`/`changes.new` use, and consequently the field-naming convention automation rule
 * triggers/conditions are matched against.
 *
 * Kept in its own module (rather than `auditLogging.ts`, which enqueues automation rule runs) so
 * `domain/automation/automationRuleEvaluation.ts` can import it without an import cycle back into
 * `auditLogging.ts`.
 */
export const flattenEntityAuditFields = (entity: Entity): Record<string, unknown> => ({
  _schemaId: entity.schema_id,
  _name: entity.name,
  _slug: entity.slug,
  _namespace: entity.namespace,
  _description: entity.description,
  _owner: entity.owner,
  _lifecycle: entity.lifecycle,
  _targetLifecycle: entity.target_lifecycle,
  _targetLifecycleDate: entity.target_lifecycle_date,
  _tags: entity.tags,
  _links: entity.links,
  _visibilityMode: entity.visibility_mode,
  ...entity.data
});
