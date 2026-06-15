import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  projectKeys,
  projectEntityKeys,
  entityContentKeys,
  invalidateAuditQueries,
  invalidateAllProjectCaches
} from './queryKeys';
import { Project, ProjectDetail, ProjectFile } from '@arch-register/api-types/projectContract';
import { orpcClient } from '../lib/orpcClient';
import { emptyDiagram, createEntityDiagramFromTemplate } from '../lib/api';

// Hook for fetching project list
export const useProjects = (workspaceId: string) => {
  return useQuery({
    queryKey: projectKeys.list(workspaceId),
    queryFn: () => orpcClient.projects.list({ params: { workspace: workspaceId } }),
    enabled: !!workspaceId
  });
};

// Hook for fetching a single project
export const useProject = (workspaceId: string, projectId: string) => {
  return useQuery({
    queryKey: projectKeys.detail(workspaceId, projectId),
    queryFn: () => orpcClient.projects.get({ params: { workspace: workspaceId, id: projectId } }),
    enabled: !!workspaceId && !!projectId
  });
};

// Hook for creating a project
export const useCreateProject = (workspaceId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: {
      name: string;
      description?: string;
      owner?: string | null;
      status?: 'draft' | 'active' | 'complete' | 'cancelled';
      color?: string | null;
    }) => orpcClient.projects.create({ params: { workspace: workspaceId }, body }),
    onSuccess: async newProject => {
      // Update project list cache with the new project
      queryClient.setQueryData(projectKeys.list(workspaceId), (old: Project[] | undefined) => {
        if (!old) return [newProject];
        return [...old, newProject];
      });
      await invalidateAuditQueries(queryClient, workspaceId);
    }
  });
};

// Hook for updating a project
export const useUpdateProject = (workspaceId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      data
    }: {
      projectId: string;
      data: {
        name: string;
        description?: string;
        owner?: string | null;
        status?: 'draft' | 'active' | 'complete' | 'cancelled';
        color?: string | null;
        target_date?: string | null;
        pinned?: boolean;
      };
    }) => orpcClient.projects.update({ params: { workspace: workspaceId, id: projectId }, body: data }),
    onSuccess: async (updatedProject, variables) => {
      // Update the project list cache
      queryClient.setQueryData(projectKeys.list(workspaceId), (old: Project[] | undefined) => {
        if (!old) return old;
        return old.map(p =>
          p.id === variables.projectId || p.public_id === variables.projectId ? updatedProject : p
        );
      });
      queryClient.setQueryData(
        projectKeys.detail(workspaceId, updatedProject.public_id),
        (old: ProjectDetail | undefined) => (old ? { ...old, ...updatedProject } : updatedProject)
      );
      await invalidateAuditQueries(queryClient, workspaceId);
    }
  });
};

// Hook for deleting a project
export const useDeleteProject = (workspaceId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projectId: string) =>
      orpcClient.projects.remove({ params: { workspace: workspaceId, id: projectId } }),
    onSuccess: async () => {
      await invalidateAllProjectCaches(queryClient, workspaceId);
    }
  });
};

// Hook for fetching entities associated with a project
export const useProjectEntities = (workspaceId: string, projectId: string) => {
  return useQuery({
    queryKey: projectEntityKeys.all(workspaceId, projectId),
    queryFn: () =>
      orpcClient.projects.listEntities({ params: { workspace: workspaceId, id: projectId } }),
    enabled: !!workspaceId && !!projectId
  });
};

// Hook for fetching projects associated with an entity
export const useEntityProjects = (workspaceId: string, entityId: string) => {
  return useQuery({
    queryKey: projectEntityKeys.entityProjects(workspaceId, entityId),
    queryFn: async () => {
      const all = await orpcClient.projects.list({ params: { workspace: workspaceId } });
      const entityEntries = await Promise.all(
        all.map(p =>
          orpcClient.projects.listEntities({ params: { workspace: workspaceId, id: p.id } })
            .then(entities => ({ project: p, entity: entities.find(e => e.entity_id === entityId) }))
        )
      );
      return entityEntries
        .filter(e => e.entity !== undefined)
        .map(e => ({ project: e.project, entity_type: e.entity!.entity_type }));
    },
    enabled: !!workspaceId && !!entityId
  });
};

// Hook for adding an entity to a project
export const useAddProjectEntity = (workspaceId: string, projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: { entity_id: string; entity_type?: string | null; is_done?: boolean }) =>
      orpcClient.projects.addEntity({ params: { workspace: workspaceId, id: projectId }, body }),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({
        queryKey: projectEntityKeys.all(workspaceId, projectId)
      });
      await queryClient.invalidateQueries({
        queryKey: projectEntityKeys.entityProjects(workspaceId, variables.entity_id)
      });
    }
  });
};

// Hook for updating a project entity
export const useUpdateProjectEntity = (workspaceId: string, projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      entityId,
      entity_type,
      is_done
    }: {
      entityId: string;
      entity_type?: string | null;
      is_done?: boolean;
    }) =>
      orpcClient.projects.updateEntity({
        params: { workspace: workspaceId, id: projectId, entityId },
        body: { entity_type, is_done }
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: projectEntityKeys.all(workspaceId, projectId)
      });
    }
  });
};

// Hook for removing an entity from a project
export const useRemoveProjectEntity = (workspaceId: string, projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (entityId: string) =>
      orpcClient.projects.removeEntity({
        params: { workspace: workspaceId, id: projectId, entityId }
      }),
    onSuccess: async (_, entityId) => {
      await queryClient.invalidateQueries({
        queryKey: projectEntityKeys.all(workspaceId, projectId)
      });
      await queryClient.invalidateQueries({
        queryKey: projectEntityKeys.entityProjects(workspaceId, entityId)
      });
    }
  });
};

// Hook for fetching diagram files that reference an entity
export const useEntityDiagramFiles = (workspaceId: string, entityId: string) => {
  return useQuery({
    queryKey: projectEntityKeys.entityDiagramFiles(workspaceId, entityId),
    queryFn: () =>
      orpcClient.projects.getEntityDiagramFiles({
        params: { workspace: workspaceId, entityId }
      }),
    enabled: !!workspaceId && !!entityId
  });
};

// Hook for fetching content nodes owned by an entity
export const useEntityContentNodes = (workspaceId: string, entityId: string) => {
  return useQuery({
    queryKey: entityContentKeys.all(workspaceId, entityId),
    queryFn: () =>
      orpcClient.projects.listEntityFiles({
        params: { workspace: workspaceId, entityId }
      }),
    enabled: !!workspaceId && !!entityId
  });
};



export const useCreateEntityFolder = (workspaceId: string, entityId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (path: string) =>
      orpcClient.projects.createEntityFolder({
        params: { workspace: workspaceId, entityId },
        body: { path }
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: entityContentKeys.all(workspaceId, entityId)
      });
    }
  });
};



export const useCreateEntityFile = (workspaceId: string, entityId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ path, body }: { path: string; body: Record<string, unknown> }) =>
      orpcClient.projects.createEntityFile({
        params: { workspace: workspaceId, entityId },
        query: { path },
        body
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: entityContentKeys.all(workspaceId, entityId)
      });
      await queryClient.invalidateQueries({
        queryKey: projectEntityKeys.entityDiagramFiles(workspaceId, entityId)
      });
    }
  });
};

// Higher-level hook for creating a blank diagram in entity content (accepts name/folder, builds path)
export const useCreateEntityDiagram = (workspaceId: string, entityId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ name, folder }: { name: string; folder?: string | null }) => {
      const filePath = folder ? `${folder}/${name}.json` : `${name}.json`;
      return orpcClient.projects.createEntityFile({
        params: { workspace: workspaceId, entityId },
        query: { path: filePath },
        body: emptyDiagram(name)
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: entityContentKeys.all(workspaceId, entityId)
      });
      await queryClient.invalidateQueries({
        queryKey: projectEntityKeys.entityDiagramFiles(workspaceId, entityId)
      });
    }
  });
};

export const useCreateEntityDiagramFromTemplate = (workspaceId: string, entityId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      name,
      templateFile,
      folder
    }: {
      name: string;
      templateFile: ProjectFile;
      folder?: string | null;
    }) => createEntityDiagramFromTemplate(workspaceId, entityId, name, templateFile, folder),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: entityContentKeys.all(workspaceId, entityId)
      });
      await queryClient.invalidateQueries({
        queryKey: projectEntityKeys.entityDiagramFiles(workspaceId, entityId)
      });
    }
  });
};
