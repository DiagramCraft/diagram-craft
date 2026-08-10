export type EntityDetailMenuAction =
  | 'viewJson'
  | 'collections'
  | 'proposeDeprecation'
  | 'clone'
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
  ...(canDelete ? ['delete' as const] : [])
];
