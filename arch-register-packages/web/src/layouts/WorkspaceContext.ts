import { createContext, useContext } from 'react';
import type { Workspace, EntitySchema, Project, WorkspaceLifecycleState, WorkspaceTeam, WorkspaceEnum } from '../api';

export type WorkspaceContextType = {
  workspace: Workspace | null;
  workspaceSlug: string;
  schemas: EntitySchema[];
  enums: WorkspaceEnum[];
  projects: Project[];
  lifecycleStates: WorkspaceLifecycleState[];
  teams: WorkspaceTeam[];
  permissions: {
    canManageWorkspaces: boolean;
    canViewSchemas: boolean;
    canEditSchemas: boolean;
    canManageTeams: boolean;
    canViewAudit: boolean;
    canCreateProjects: boolean;
    canCreateEntities: boolean;
    canManageMembers: boolean;
    canManageViews: boolean;
  };
  availableSettingsSections: string[];
  defaultSettingsSection: string | null;
  openAddProjectDialog: () => void;
  openAddEntityDialog: () => void;
};

export const WorkspaceContext = createContext<WorkspaceContextType>(null!);

export const useWorkspaceContext = () => useContext(WorkspaceContext);
