import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';

export type RelationFieldGroupSegment = {
  group: RelationSchema['groups'][number] | null;
  fields: RelationSchema['fields'];
};

/**
 * Groups a relation schema's fields by their `groupId`, preserving the fields' declared order and
 * placing each group's header at the position of its first field rather than moving grouped
 * fields to the end. Unlike entities (EntityOverviewLayout's admin-configurable panel/block
 * layout), relations have no layout system, so this derives grouping directly from `field.groupId`
 * + `schema.groups` for display in the relation dialogs/editors.
 */
export const groupRelationFields = (
  fields: RelationSchema['fields'],
  groups: RelationSchema['groups'] | undefined
): RelationFieldGroupSegment[] => {
  const groupsById = new Map((groups ?? []).map(group => [group.id, group]));
  const segments: RelationFieldGroupSegment[] = [];
  const segmentByGroupId = new Map<string, RelationFieldGroupSegment>();

  for (const field of fields) {
    const group = field.groupId ? groupsById.get(field.groupId) : undefined;
    if (!group) {
      segments.push({ group: null, fields: [field] });
      continue;
    }
    const existing = segmentByGroupId.get(group.id);
    if (existing) {
      existing.fields.push(field);
    } else {
      const segment: RelationFieldGroupSegment = { group, fields: [field] };
      segmentByGroupId.set(group.id, segment);
      segments.push(segment);
    }
  }
  return segments;
};
