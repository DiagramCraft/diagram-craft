import { useMemo, useRef, useState } from 'react';
import { useOpenDiagram } from '../../diagram/useOpenDiagram';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { Button } from '@diagram-craft/app-components/Button';
import { TbFileText, TbFolderOpen, TbPlus, TbUpload } from 'react-icons/tb';
import type { ProjectDetail as ProjectDetailData } from '@arch-register/api-types/projectCrudContract';
import type { ProjectFile } from '@arch-register/api-types/projectContentContract';
import styles from './ProjectContent.module.css';
import { DiagramBrowserToolbar } from '../../../components/diagram-browser/DiagramBrowserView';
import { ProjectDiagramsView } from './ProjectDiagramsView';
import { ProjectFileTemplateMenuItems } from './ProjectFileTemplateMenuItems';
import { AddContentFolderDialog } from '../../../components/AddContentFolderDialog';
import { AddDiagramDialog } from '../../../dialogs/AddDiagramDialog';
import { AddMarkdownDialog } from '../../markdown/AddMarkdownDialog';
import { ProjectMetaItem, ProjectScreenLayout } from '../shared/ProjectScreenLayout';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { useContentScopeOperations, type ContentScope } from '../../../hooks/useContentScope';
import { useContentFileContextMenu } from '../../../components/useContentFileContextMenu';
import { Menu } from '@diagram-craft/app-components/src/Menu';
import { MenuButton } from '@diagram-craft/app-components/MenuButton';
import { applicationWorkspacePath } from '../../../lib/applicationApi';
import { downloadUrl } from '../../../lib/browserDownload';
import {
  asProjectPublicId,
  projectContentFolderRoute,
  projectDiagramRoute,
  projectMarkdownDraftRoute,
  projectMarkdownRoute
} from '../../../routes/publicObjectRoutes';
import type { ProjectSearchParams } from '../../../routes/searchParams';
import { formatDate } from '../../../utils/dateFormat';

type ContentDialog = 'folder' | 'diagram' | 'markdown';

export const ProjectContent = ({
  project,
  folderPath,
  visibleFiles,
  allFilesCount,
  folderCount
}: {
  project: ProjectDetailData;
  folderPath: string;
  visibleFiles: ProjectFile[];
  allFilesCount: number;
  folderCount: number;
}) => {
  const navigate = useNavigate();
  const { openDiagram, dialog: openDiagramDialog } = useOpenDiagram();
  const { workspaceSlug } = useWorkspaceContext();
  const projectId = useParams({ strict: false }).projectId!;
  const search = useSearch({ strict: false }) as ProjectSearchParams;
  const publicProjectId = asProjectPublicId(projectId);
  const [dialog, setDialog] = useState<ContentDialog | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filter = search.contentQuery ?? '';
  const viewMode = search.contentView ?? 'grid';

  const scope: ContentScope = useMemo(
    () => ({ kind: 'project', workspaceId: workspaceSlug, projectId }),
    [workspaceSlug, projectId]
  );
  const contentOperations = useContentScopeOperations(scope);

  const triggerDownload = (file: ProjectFile) => {
    downloadUrl(
      applicationWorkspacePath(
        workspaceSlug,
        `/projects/${projectId}/files/download?path=${encodeURIComponent(file.path)}`
      ),
      file.original_filename ?? file.name
    );
  };

  const fileMenu = useContentFileContextMenu({
    folders: project.files.folders,
    operations: contentOperations,
    onDownload: triggerDownload,
    extraItems: (file, closeMenu) =>
      file.type === 'diagram' ? (
        <ProjectFileTemplateMenuItems
          workspaceId={workspaceSlug}
          projectId={projectId}
          file={file}
          onDone={closeMenu}
        />
      ) : null
  });

  const contentRoute = () => projectContentFolderRoute(workspaceSlug, publicProjectId, folderPath);

  const setFilter = (value: string) =>
    navigate({
      ...contentRoute(),
      search: { ...search, contentQuery: value === '' ? undefined : value },
      replace: true
    });

  const setViewMode = (value: 'grid' | 'list') =>
    navigate({
      ...contentRoute(),
      search: { ...search, contentView: value === 'grid' ? undefined : value }
    });

  const openMarkdown = (nodeId: string, mode: 'edit' | 'preview' = 'preview') =>
    navigate(projectMarkdownRoute(workspaceSlug, publicProjectId, nodeId, { mode }));

  return (
    <>
      {openDiagramDialog}
      <ProjectScreenLayout
        projectName={project.name}
        trailingBreadcrumbs={[{ label: folderPath }]}
        title={folderPath}
        actions={
          project.canManageFiles ? (
            <MenuButton.Root>
              <MenuButton.Trigger
                element={
                  <Button variant="primary" icon={<TbPlus size={12} />}>
                    New
                  </Button>
                }
              />
              <MenuButton.Menu align="end">
                <Menu.Item
                  leftSlot={<TbFolderOpen size={13} />}
                  onClick={() => setDialog('folder')}
                >
                  New folder
                </Menu.Item>
                <Menu.Item
                  leftSlot={<TbUpload size={13} />}
                  onClick={() => fileInputRef.current?.click()}
                >
                  Upload file
                </Menu.Item>
                <Menu.Item leftSlot={<TbPlus size={13} />} onClick={() => setDialog('diagram')}>
                  New diagram
                </Menu.Item>
                <Menu.Item
                  leftSlot={<TbFileText size={13} />}
                  onClick={() => setDialog('markdown')}
                >
                  New wiki page
                </Menu.Item>
              </MenuButton.Menu>
            </MenuButton.Root>
          ) : null
        }
        meta={
          <>
            <ProjectMetaItem
              label="Items"
              value={<span className="mono tabular">{allFilesCount}</span>}
            />
            <ProjectMetaItem
              label="Folders"
              value={<span className="mono tabular">{folderCount}</span>}
            />
            <ProjectMetaItem label="Owner" value={project.owner?.name ?? '—'} />
            <ProjectMetaItem label="Last edit" value={formatDate(project.updated_at)} />
          </>
        }
        toolbar={
          <DiagramBrowserToolbar
            label={
              <div
                className={styles.sectionLabel}
                style={{ margin: 0 }}
              >{`Content (${visibleFiles.length})`}</div>
            }
            filter={filter}
            onFilterChange={setFilter}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />
        }
      >
        <ProjectDiagramsView
          project={project}
          visibleFiles={visibleFiles}
          folderFilter={folderPath}
          filter={filter}
          viewMode={viewMode}
          onOpenDiagram={diagramId =>
            void openDiagram(diagramId, () =>
              navigate(projectDiagramRoute(workspaceSlug, publicProjectId, diagramId))
            )
          }
          onOpenMarkdown={nodeId => openMarkdown(nodeId)}
          onDownloadFile={triggerDownload}
          onContextMenu={project.canManageFiles ? fileMenu.open : undefined}
        />

        {project.canManageFiles && (
          <>
            <AddContentFolderDialog
              scope={scope}
              open={dialog === 'folder'}
              onClose={() => setDialog(null)}
              onCreated={() => {}}
              parentFolder={folderPath}
            />
            <AddDiagramDialog
              open={dialog === 'diagram'}
              onClose={() => setDialog(null)}
              onCreated={() => {}}
              workspaceId={workspaceSlug}
              context="project"
              projectId={projectId}
              projectName={project.name}
              folder={folderPath}
            />
            <AddMarkdownDialog
              open={dialog === 'markdown'}
              onClose={() => setDialog(null)}
              workspaceSlug={workspaceSlug}
              projectId={projectId}
              scope={scope}
              folder={folderPath || null}
              onCreated={file => openMarkdown(file.id, 'edit')}
              onOpenDraft={draft =>
                navigate(
                  projectMarkdownDraftRoute(workspaceSlug, publicProjectId, {
                    draftName: draft.name,
                    draftFolder: folderPath,
                    draftType: draft.documentTypeId ?? undefined,
                    draftTemplate: draft.templateId ?? undefined
                  })
                )
              }
              onCreate={name =>
                contentOperations.createMarkdown.mutateAsync({ name, folder: folderPath })
              }
              isPending={contentOperations.createMarkdown.isPending}
            />
            <input
              ref={fileInputRef}
              type="file"
              style={{ display: 'none' }}
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) contentOperations.upload.mutate({ file, folder: folderPath });
                e.target.value = '';
              }}
            />
          </>
        )}
        {fileMenu.element}
      </ProjectScreenLayout>
    </>
  );
};
