import { useRef, useState } from 'react';
import type { ProjectFile } from '@arch-register/api-types/projectContract';
import type { SavedView } from '@arch-register/api-types/viewContract';
import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import { ContextMenu } from '@diagram-craft/app-components/src/ContextMenu';
import { Menu } from '@diagram-craft/app-components/src/Menu';
import { MenuButton } from '@diagram-craft/app-components/MenuButton';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import {
  TbBinaryTree2, TbCalendarWeek, TbChartRadar, TbClipboardList, TbColumns3, TbFileText,
  TbFolderOpen, TbHome, TbLayoutBoard, TbLayoutGrid, TbList, TbPencil, TbPlus, TbTrash, TbUpload
} from 'react-icons/tb';
import { ContentTree, type ContentTreeHandle } from '../../components/ContentTree';
import { ContentFolderDialog } from '../../components/ContentFolderDialog';
import { RenameDialog } from '../../components/RenameDialog';
import { SidebarGroupLabel, SidebarHeader } from '../../components/sidebar/SidebarPrimitives';
import { TreeRow } from '../../components/TreeRow';
import { useAssessments } from '../../hooks/useAssessments';
import { useDeleteSavedView, useSavedViews, useUpdateSavedView } from '../../hooks/useEntities';
import { contentDownloadUrl, useContentScopeOperations, type ContentScope } from '../../hooks/useContentScope';
import { useProject, useProjectEntities } from '../../hooks/useProjects';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import {
  asProjectPublicId, projectDetailRoute, projectDiagramRoute, projectMarkdownRoute
} from '../../routes/publicObjectRoutes';
import styles from '../../shell/SidePanel.module.css';
import { toSavedViewSearch } from '../entities/components/entityBrowserState';
import { AddMarkdownDialog } from '../markdown/AddMarkdownDialog';
import { AddDiagramDialog } from './AddDiagramDialog';

type ProjectSection = 'home' | 'entities' | 'assessments';
type SidebarTab = 'content' | 'views';

export const ProjectContentSidebar = ({ workspaceSlug, projectId }: { workspaceSlug: string; projectId: string }) => {
  const scope: ContentScope = { kind: 'project', workspaceId: workspaceSlug, projectId };
  const operations = useContentScopeOperations(scope);
  const { permissions } = useWorkspaceContext();
  const { data: project } = useProject(workspaceSlug, projectId);
  const { data: projectEntities = [] } = useProjectEntities(workspaceSlug, projectId);
  const { data: assessments = [] } = useAssessments(workspaceSlug, projectId);
  const { data: savedViews = [] } = useSavedViews(workspaceSlug, { projectId });
  const projectViews = savedViews.filter(view => view.scope === 'project');
  const deleteView = useDeleteSavedView(workspaceSlug);
  const updateView = useUpdateSavedView(workspaceSlug);
  const treeRef = useRef<ContentTreeHandle>(null);
  const [tab, setTab] = useState<SidebarTab>('content');
  const [folderDialog, setFolderDialog] = useState<{ open: boolean; parent: string | null }>({ open: false, parent: null });
  const [diagramFolder, setDiagramFolder] = useState<string | null | undefined>(undefined);
  const [markdownFolder, setMarkdownFolder] = useState<string | null | undefined>(undefined);
  const [viewMenu, setViewMenu] = useState<{ x: number; y: number; view: SavedView } | null>(null);
  const [renameView, setRenameView] = useState<SavedView | null>(null);
  const [deleteViewTarget, setDeleteViewTarget] = useState<SavedView | null>(null);
  const navigate = useNavigate();
  const params = useParams({ strict: false });
  const search = useSearch({ strict: false });
  const section: ProjectSection = search.section === 'entities' || search.section === 'assessments' ? search.section : 'home';
  const activeFileId = params.nodeId ?? params.diagramId ?? null;

  const navigateProject = (next: { section?: ProjectSection; folder?: string }) => navigate(projectDetailRoute(
    workspaceSlug, asProjectPublicId(projectId), {
      tab: search.tab, section: next.section ?? section, folder: next.folder, dialog: search.dialog,
      contentQuery: search.contentQuery, contentView: search.contentView
    }
  ));
  const openFile = (file: ProjectFile) => navigate(file.type === 'markdown'
    ? projectMarkdownRoute(workspaceSlug, asProjectPublicId(projectId), file.id)
    : projectDiagramRoute(workspaceSlug, asProjectPublicId(projectId), file.id));
  const download = (file: ProjectFile) => {
    const anchor = document.createElement('a');
    anchor.href = contentDownloadUrl(scope, file.path); anchor.download = file.original_filename ?? file.name;
    document.body.appendChild(anchor); anchor.click(); document.body.removeChild(anchor);
  };
  const viewIcon = (mode: SavedView['viewMode']) => {
    switch (mode) {
      case 'table': return <TbList size={12} />;
      case 'cards': return <TbLayoutGrid size={12} />;
      case 'tree': return <TbBinaryTree2 size={12} />;
      case 'radar': return <TbChartRadar size={12} />;
      case 'timeline': return <TbCalendarWeek size={12} />;
      case 'hierarchy': return <TbLayoutBoard size={12} />;
      case 'explore': return <TbColumns3 size={12} />;
      default: return <TbHome size={12} />;
    }
  };
  const applyView = (view: SavedView) => navigate(projectDetailRoute(workspaceSlug, asProjectPublicId(projectId), {
    tab: search.tab, section: 'entities', contentQuery: search.contentQuery,
    contentView: search.contentView, ...toSavedViewSearch(view)
  }));
  const openAddEntity = () => navigate(projectDetailRoute(workspaceSlug, asProjectPublicId(projectId), {
    tab: search.tab, section: 'entities', folder: search.folder, dialog: 'add-entity',
    contentQuery: search.contentQuery, contentView: search.contentView
  }));
  const contentRows = <>
    <TreeRow testId="project-secondary-home" label="Home" icon={<TbHome size={13} />}
      active={section === 'home' && !search.folder && !activeFileId}
      onClick={() => navigateProject({ section: 'home' })} />
    <TreeRow testId="project-secondary-entities" label={`Entities (${projectEntities.length})`}
      icon={<TbBinaryTree2 size={13} />} active={section === 'entities'}
      onClick={() => navigateProject({ section: 'entities', folder: search.folder })} />
    <TreeRow testId="project-secondary-assessments" label={`Assessments (${assessments.length})`}
      icon={<TbClipboardList size={13} />} active={section === 'assessments'}
      onClick={() => navigateProject({ section: 'assessments', folder: search.folder })} />
  </>;

  const renderViews = (admin: boolean, label: string) => {
    const views = projectViews.filter(view => view.isAdminView === admin);
    return views.length ? <><SidebarGroupLabel>{label}</SidebarGroupLabel>{views.map(view =>
      <TreeRow key={view.id} icon={viewIcon(view.viewMode)} label={view.name} active={search.viewId === view.id}
        onClick={() => applyView(view)} onContextMenu={event => {
          if (admin ? !permissions.canManageAdminViews : !project?.canEdit) return;
          event.preventDefault(); event.stopPropagation();
          setViewMenu({ x: event.clientX, y: event.clientY, view });
        }} />)}</> : null;
  };

  return <>
    <SidebarHeader actions={tab === 'content' ? <MenuButton.Root>
      <MenuButton.Trigger element={<button type="button" className={styles.action} title="Add"><TbPlus size={13} /></button>} />
      <MenuButton.Menu>
        <Menu.Item disabled={!project?.canManageFiles} leftSlot={<TbFolderOpen size={13} />} onClick={() => setFolderDialog({ open: true, parent: section === 'home' ? search.folder ?? null : null })}>New folder</Menu.Item>
        <Menu.Item disabled={!project?.canManageFiles} leftSlot={<TbPlus size={13} />} onClick={() => setDiagramFolder(section === 'home' ? search.folder ?? null : null)}>New diagram</Menu.Item>
        <Menu.Item disabled={!project?.canManageFiles} leftSlot={<TbUpload size={13} />} onClick={() => treeRef.current?.openUpload(section === 'home' ? search.folder ?? null : null)}>Upload file</Menu.Item>
        <Menu.Item disabled={!project?.canManageFiles} leftSlot={<TbFileText size={13} />} onClick={() => setMarkdownFolder(section === 'home' ? search.folder ?? null : null)}>New wiki page</Menu.Item>
        <Menu.Item disabled={!project?.canEdit} leftSlot={<TbBinaryTree2 size={13} />} onClick={openAddEntity}>Add entity</Menu.Item>
      </MenuButton.Menu>
    </MenuButton.Root> : null}>
      <Tabs.Root value={tab} onValueChange={value => setTab(value as SidebarTab)}><Tabs.List>
        <Tabs.Trigger value="content">Content</Tabs.Trigger><Tabs.Trigger value="views">Views</Tabs.Trigger>
      </Tabs.List></Tabs.Root>
    </SidebarHeader>
    <div className={styles.scroll}>{tab === 'content' ?
      <ContentTree ref={treeRef} rootFiles={project?.files.rootFiles ?? []} folders={project?.files.folders ?? []}
        activeFileId={activeFileId} activeFolder={section === 'home' ? search.folder ?? null : null}
        operations={operations} initiallyExpanded beforeTree={contentRows}
        onFolderClick={folder => navigateProject({ section: 'home', folder })}
        onFileClick={openFile} onDownload={download}
        onCreateFolder={parent => setFolderDialog({ open: true, parent })}
        onCreateDiagram={setDiagramFolder} onCreateMarkdown={setMarkdownFolder} />
      : <>{renderViews(true, 'Workspace views')}{renderViews(false, 'Views')}
          {!projectViews.length && <div className={`${styles.emptyState} dim`}>No saved views yet.</div>}</>}
    </div>
    {viewMenu && <ContextMenu.Imperative x={viewMenu.x} y={viewMenu.y} onClose={() => setViewMenu(null)}>
      <Menu.Item leftSlot={<TbPencil size={13} />} onClick={() => setRenameView(viewMenu.view)}>Rename</Menu.Item>
      <Menu.Separator /><Menu.Item type="danger" leftSlot={<TbTrash size={13} />} onClick={() => setDeleteViewTarget(viewMenu.view)}>Delete</Menu.Item>
    </ContextMenu.Imperative>}
    {renameView && <RenameDialog open currentName={renameView.name} entityType="view"
      onRename={name => { updateView.mutate({ id: renameView.id, body: { name } }); setRenameView(null); }}
      onCancel={() => setRenameView(null)} />}
    <DeleteConfirmationDialog open={!!deleteViewTarget} title="Delete view?"
      message={<>The view <b>{deleteViewTarget?.name}</b> will be permanently deleted.</>}
      detail="This can't be undone." confirmLabel="Delete view"
      onConfirm={() => { if (deleteViewTarget) deleteView.mutate(deleteViewTarget.id); setDeleteViewTarget(null); }}
      onCancel={() => setDeleteViewTarget(null)} />
    {project?.canManageFiles && <ContentFolderDialog open={folderDialog.open}
      onClose={() => setFolderDialog({ open: false, parent: null })} onCreated={() => setFolderDialog({ open: false, parent: null })}
      onSubmit={path => operations.createFolder.mutateAsync(path)} isPending={operations.createFolder.isPending}
      parentFolder={folderDialog.parent ?? undefined} placeholder="e.g. Architecture" />}
    {project?.canManageFiles && <AddDiagramDialog open={diagramFolder !== undefined}
      onClose={() => setDiagramFolder(undefined)} onCreated={() => setDiagramFolder(undefined)}
      workspaceId={workspaceSlug} context="project" projectId={projectId} projectName={project.name}
      folder={diagramFolder ?? null} />}
    {project?.canManageFiles && <AddMarkdownDialog open={markdownFolder !== undefined}
      onClose={() => setMarkdownFolder(undefined)}
      onCreated={file => { setMarkdownFolder(undefined); openFile(file); }}
      onCreate={name => operations.createMarkdown.mutateAsync({ name, folder: markdownFolder ?? null })}
      isPending={operations.createMarkdown.isPending} />}
  </>;
};
