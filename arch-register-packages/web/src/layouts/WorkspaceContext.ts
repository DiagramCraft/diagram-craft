import { createContext, useContext } from 'react';
import type { WorkspaceTeam } from '../lib/api';
import { Workspace, WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import { EntitySchema } from '@arch-register/api-types/schemaContract';
import { Project } from '@arch-register/api-types/projectContract';
import { WorkspaceEnum } from '@arch-register/api-types/enumContract';
export type ProjectEntityType = { id: string; label: string; sort_order: number };

export type WorkspaceContextType = {
  workspace: Workspace | null;
  workspaceSlug: string;
  schemas: EntitySchema[];
  enums: WorkspaceEnum[];
  projects: Project[];
  lifecycleStates: WorkspaceLifecycleState[];
  teams: WorkspaceTeam[];
  projectEntityTypes: ProjectEntityType[];
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
    canManageAdminViews: boolean;
  };
  availableSettingsSections: string[];
  defaultSettingsSection: string | null;
  openAddProjectDialog: () => void;
  openAddEntityDialog: () => void;
};

export const WorkspaceContext = createContext<WorkspaceContextType>(null!);

export const useWorkspaceContext = () => useContext(WorkspaceContext);
