import type { FieldGroupAccess, FieldGroupAccessControl } from '@arch-register/permissions';

type GroupWithAccessControl = { id: string; accessControl?: FieldGroupAccessControl };
type FieldGroupLink = { groupId: string; teamIds?: string[] };

export const resolveGroupAccessControl = (
  group: GroupWithAccessControl,
  sharedFieldGroupLinks: FieldGroupLink[]
): FieldGroupAccessControl | undefined => {
  const link = sharedFieldGroupLinks.find(l => l.groupId === group.id);
  if (link) return link.teamIds ? { teamIds: link.teamIds } : undefined;
  return group.accessControl;
};

export type FieldGroupSchemaShape = {
  groups?: GroupWithAccessControl[];
  shared_field_group_links?: FieldGroupLink[];
};

/**
 * Evaluates the viewer's access to a single field via its `groupId`, on any schema
 * shaped like an entity or relation schema (both carry `groups` and
 * `shared_field_group_links`). A field with no `groupId` is unrestricted.
 */
export const resolveFieldAccess = (
  schema: FieldGroupSchemaShape,
  field: { groupId?: string },
  getFieldGroupAccess: (accessControl: FieldGroupAccessControl | undefined) => FieldGroupAccess
): FieldGroupAccess => {
  if (!field.groupId) return 'edit';
  const group = schema.groups?.find(candidate => candidate.id === field.groupId);
  const accessControl = resolveGroupAccessControl(
    group ?? { id: field.groupId },
    schema.shared_field_group_links ?? []
  );
  return getFieldGroupAccess(accessControl);
};
