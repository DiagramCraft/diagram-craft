import { createContext, useContext } from 'react';
import type { Workspace, EntitySchema, Project, WorkspaceLifecycleState, WorkspaceTeam } from '../api';

export type WorkspaceContextType = {
  workspace: Workspace | null;
  workspaceSlug: string;
  schemas: EntitySchema[];
  projects: Project[];
  lifecycleStates: WorkspaceLifecycleState[];
  teams: WorkspaceTeam[];
  permissions: {
    canManageWorkspaces: boolean;
    canManageGlobalRoles: boolean;
    canViewSchemas: boolean;
    canEditSchemas: boolean;
    canManageTeams: boolean;
    canViewAudit: boolean;
    canCreateProjects: boolean;
    canCreateEntities: boolean;
    canManageMembers: boolean;
  };
  availableSettingsSections: string[];
  defaultSettingsSection: string | null;
  openAddProjectDialog: () => void;
  openAddEntityDialog: () => void;
};

export const WorkspaceContext = createContext<WorkspaceContextType>(null!);

export const useWorkspaceContext = () => useContext(WorkspaceContext);
