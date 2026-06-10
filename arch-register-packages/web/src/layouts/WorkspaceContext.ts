import { createContext, useContext } from 'react';
import type { WorkspaceTeam } from '../lib/api';
import { Workspace, WorkspaceLifecycleState } from '@arch-register/api-types/workspaces';
import { EntitySchema, WorkspaceEnum } from '@arch-register/api-types/schemas';
import { Project } from '@arch-register/api-types/projects';

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
