import { createContext, useContext } from 'react';
import type { WorkspaceTeam } from '@arch-register/api-types/workspaceConfigContract';
import { Workspace, WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import { EntitySchema } from '@arch-register/api-types/schemaContract';
import { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import { Project } from '@arch-register/api-types/projectContract';
import { WorkspaceEnum } from '@arch-register/api-types/enumContract';
import { SharedFieldGroup } from '@arch-register/api-types/fieldGroupContract';
export type ProjectEntityType = { id: string; label: string; sort_order: number };

export type WorkspaceContextType = {
  workspace: Workspace | null;
  workspaceSlug: string;
  schemas: EntitySchema[];
  relationSchemas: RelationSchema[];
  enums: WorkspaceEnum[];
  fieldGroups?: SharedFieldGroup[];
  projects: Project[];
  lifecycleStates: WorkspaceLifecycleState[];
  teams: WorkspaceTeam[];
  projectEntityTypes: ProjectEntityType[];
  permissions: {
    canManageWorkspaces: boolean;
    canAdministerWorkspace?: boolean;
    canViewSchemas: boolean;
    canEditSchemas: boolean;
    canManageTeams: boolean;
    canViewAudit: boolean;
    canCreateProjects: boolean;
    canCreateEntities: boolean;
    canManageMembers: boolean;
    canManageJobs: boolean;
    canManageViews: boolean;
    canManageDashboard: boolean;
    canManageAdminViews: boolean;
  };
  availableSettingsSections: string[];
  defaultSettingsSection: string | null;
  openAddProjectDialog: () => void;
  openAddEntityDialog: () => void;
};

export const WorkspaceContext = createContext<WorkspaceContextType>(null!);

export const useWorkspaceContext = () => useContext(WorkspaceContext);
