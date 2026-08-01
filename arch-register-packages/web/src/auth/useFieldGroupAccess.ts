import { useMemo } from 'react';
import {
  getFieldGroupAccess,
  type FieldGroupAccess,
  type FieldGroupAccessControl
} from '@arch-register/permissions';
import { useAuth } from './AuthContext';
import { useAuthorizationData } from './AuthorizationDataContext';
import { buildWorkspaceAuthorizationContextFromAuthData } from './authorizationContextAdapter';

export const useFieldGroupAccess = (
  workspaceId: string | null | undefined
): ((accessControl: FieldGroupAccessControl | undefined) => FieldGroupAccess) => {
  const { user } = useAuth();
  const authorizationData = useAuthorizationData();

  return useMemo(() => {
    const context =
      user && authorizationData
        ? buildWorkspaceAuthorizationContextFromAuthData(user.id, authorizationData, workspaceId)
        : null;

    return (accessControl: FieldGroupAccessControl | undefined): FieldGroupAccess =>
      context ? getFieldGroupAccess(context, accessControl) : 'edit';
  }, [authorizationData, user, workspaceId]);
};
