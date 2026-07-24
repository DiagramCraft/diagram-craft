import type { EntityRecord } from '@arch-register/api-types/entityContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { EntityEditState } from './entityEditState';

/**
 * Builds the `proposed_state` blob stored on a planned-change snapshot/case member, merging the
 * edited fields in `planState` over the entity's current values. When editing an existing plan,
 * `existingProposed` supplies fields the form doesn't surface (slug, namespace, tags, links,
 * schema_id, project_id) so re-saving doesn't clobber them.
 */
export const buildProposedState = (
  entity: EntityRecord,
  schema: EntitySchema,
  planState: EntityEditState,
  existingProposed?: Record<string, unknown> | null
): Record<string, unknown> => {
  const customData: Record<string, unknown> = {};
  for (const f of schema.fields) {
    customData[f.id] = planState[f.id] ?? '';
  }

  return {
    name: (planState['_name'] as string) ?? entity._name,
    slug: existingProposed?.slug ?? entity._slug,
    namespace: existingProposed?.namespace ?? entity._namespace,
    description: (planState['_description'] as string) ?? entity._description,
    owner: (planState['_owner'] as string) ?? null,
    lifecycle: (planState['_lifecycle'] as string) ?? null,
    target_lifecycle: (planState['_targetLifecycle'] as string) ?? null,
    target_lifecycle_date: (planState['_targetLifecycleDate'] as string) ?? null,
    tags: existingProposed?.tags ?? entity._tags,
    links: existingProposed?.links ?? entity._links,
    schema_id: existingProposed?.schema_id ?? entity._schema.id,
    data: customData,
    project_id: existingProposed?.project_id ?? entity._projectId ?? null
  };
};
