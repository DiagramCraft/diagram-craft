import { createContext, useContext, type ReactNode } from 'react';
import type { AuthBaseData, WorkspaceOwnerOption, WorkspaceTeamMembership, GlobalPermission, GlobalRole } from './types';

export type {
  AuthBaseData,
  WorkspaceOwnerOption,
  WorkspaceTeamMembership,
  GlobalPermission,
  GlobalRole
};

const AuthorizationDataContext = createContext<AuthBaseData | null>(null);

export const AuthorizationDataProvider = ({
  value,
  children
}: {
  value: AuthBaseData | null;
  children: ReactNode;
}) => (
  <AuthorizationDataContext.Provider value={value}>{children}</AuthorizationDataContext.Provider>
);

export const useAuthorizationData = () => {
  const context = useContext(AuthorizationDataContext);
  return context;
};
