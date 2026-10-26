import { useState, type ReactNode } from 'react';
import { useNavigate } from '@tanstack/react-router';
import type { ProjectFile } from '@arch-register/api-types/projectContentContract';
import { AddContentFolderDialog } from '../../components/AddContentFolderDialog';
import { AddDiagramDialog } from '../../dialogs/AddDiagramDialog';
import type { ContentScope, useContentScopeOperations } from '../../hooks/useContentScope';
import { asProjectPublicId, projectMarkdownDraftRoute } from '../../routes/publicObjectRoutes';
import { AddMarkdownDialog } from '../markdown/AddMarkdownDialog';

type CreateDialog = { kind: 'folder' | 'diagram' | 'markdown'; folder: string | null };

/**
 * The dialogs for adding a folder, diagram or wiki page to the project content, which several
 * parts of the sidebar can open. Open one with `openFolder`/`openDiagram`/`openMarkdown` (passing
 * the folder to add to, or null for the root) and render `element` once.
 */
export const useProjectContentCreateDialogs = ({
  scope,
  operations,
  project,
  openFile
}: {
  scope: Extract<ContentScope, { kind: 'project' }>;
  operations: ReturnType<typeof useContentScopeOperations>;
  project: { name: string; canManageFiles: boolean } | undefined;
  openFile: (file: ProjectFile) => void;
}): {
  openFolder: (parent: string | null) => void;
  openDiagram: (folder: string | null) => void;
  openMarkdown: (folder: string | null) => void;
  element: ReactNode;
} => {
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<CreateDialog | null>(null);
  const close = () => setDialog(null);
  const folder = dialog?.folder ?? null;

  const element = project?.canManageFiles ? (
    <>
      <AddContentFolderDialog
        scope={scope}
        open={dialog?.kind === 'folder'}
        onClose={close}
        onCreated={close}
        parentFolder={folder ?? undefined}
        placeholder="e.g. Architecture"
      />
      <AddDiagramDialog
        open={dialog?.kind === 'diagram'}
        onClose={close}
        onCreated={close}
        workspaceId={scope.workspaceId}
        context="project"
        projectId={scope.projectId}
        projectName={project.name}
        folder={folder}
      />
      <AddMarkdownDialog
        open={dialog?.kind === 'markdown'}
        onClose={close}
        workspaceSlug={scope.workspaceId}
        projectId={scope.projectId}
        onCreated={file => {
          close();
          openFile(file);
        }}
        onOpenDraft={draft =>
          navigate(
            projectMarkdownDraftRoute(scope.workspaceId, asProjectPublicId(scope.projectId), {
              draftName: draft.name,
              draftFolder: folder ?? undefined,
              draftType: draft.documentTypeId ?? undefined,
              draftTemplate: draft.templateId ?? undefined
            })
          )
        }
        onCreate={name => operations.createMarkdown.mutateAsync({ name, folder })}
        isPending={operations.createMarkdown.isPending}
      />
    </>
  ) : null;

  return {
    openFolder: parent => setDialog({ kind: 'folder', folder: parent }),
    openDiagram: target => setDialog({ kind: 'diagram', folder: target }),
    openMarkdown: target => setDialog({ kind: 'markdown', folder: target }),
    element
  };
};
