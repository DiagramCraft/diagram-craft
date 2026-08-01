import type { FieldGroupAccessControl } from '@arch-register/permissions';

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
