export type EntityDetailMenuAction =
  | 'viewJson'
  | 'collections'
  | 'proposeDeprecation'
  | 'clone'
  | 'mergeInto'
  | 'delete';

export type EntityDetailMenuState = {
  canEdit: boolean;
  canCreateChild: boolean;
  canDelete: boolean;
  deprecationPolicyRequired: boolean;
  hasDeprecation: boolean;
};

export const getEntityDetailMenuActions = ({
  canEdit,
  canCreateChild,
  canDelete,
  deprecationPolicyRequired,
  hasDeprecation
}: EntityDetailMenuState): EntityDetailMenuAction[] => [
  'viewJson',
  'collections',
  ...(canEdit && deprecationPolicyRequired && !hasDeprecation
    ? ['proposeDeprecation' as const]
    : []),
  ...(canCreateChild ? ['clone' as const] : []),
  // Merge requires the same admin_entity permission as delete, so it's gated on the same flag.
  ...(canDelete ? ['mergeInto' as const] : []),
  ...(canDelete ? ['delete' as const] : [])
];
