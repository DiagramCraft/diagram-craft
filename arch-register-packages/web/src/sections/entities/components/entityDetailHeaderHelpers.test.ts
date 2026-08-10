import { describe, expect, it } from 'vitest';
import { getEntityDetailMenuActions } from './entityDetailHeaderHelpers';

const baseState = {
  canEdit: false,
  canCreateChild: false,
  canDelete: false,
  deprecationPolicyRequired: false,
  hasDeprecation: false
};

describe('getEntityDetailMenuActions', () => {
  it('always exposes JSON and collection actions', () => {
    expect(getEntityDetailMenuActions(baseState)).toEqual(['viewJson', 'collections']);
  });

  it('gates deprecation, clone, and delete actions by permissions and state', () => {
    expect(
      getEntityDetailMenuActions({
        ...baseState,
        canEdit: true,
        canCreateChild: true,
        canDelete: true,
        deprecationPolicyRequired: true
      })
    ).toEqual(['viewJson', 'collections', 'proposeDeprecation', 'clone', 'delete']);

    expect(
      getEntityDetailMenuActions({
        ...baseState,
        canEdit: true,
        deprecationPolicyRequired: true,
        hasDeprecation: true
      })
    ).toEqual(['viewJson', 'collections']);
  });
});
