import type { FieldGroupAccessControl } from '@arch-register/permissions';
import type { SchemaGroup, SharedFieldGroupLink } from '@arch-register/api-types/schemaContract';

export const resolveGroupAccessControl = (
  group: SchemaGroup,
  sharedFieldGroupLinks: SharedFieldGroupLink[]
): FieldGroupAccessControl | undefined => {
  const link = sharedFieldGroupLinks.find(l => l.groupId === group.id);
  if (link) return link.teamIds ? { teamIds: link.teamIds } : undefined;
  return group.accessControl;
};
