import { createContext, type ReactNode, useContext } from 'react';
import type {
  AuthBaseData,
  GlobalPermission,
  GlobalRole,
  WorkspaceTeam,
  WorkspaceRole
} from './types';

export type { AuthBaseData, WorkspaceTeam, GlobalPermission, GlobalRole, WorkspaceRole };

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
  return useContext(AuthorizationDataContext);
};
