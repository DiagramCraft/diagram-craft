import { useEffect, useRef, useState } from 'react';
import type { ProjectFile } from '@arch-register/api-types/projectContentContract';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import { Menu } from '@diagram-craft/app-components/src/Menu';
import { MenuButton } from '@diagram-craft/app-components/MenuButton';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import {
  TbBinaryTree2,
  TbClipboardList,
  TbFileText,
  TbCalendarEvent,
  TbFolderOpen,
  TbHome,
  TbPlus,
  TbUpload,
  TbBookmark
} from 'react-icons/tb';
import { ContentTree, type ContentTreeHandle } from '../../components/ContentTree';
import { SidebarHeader } from '../../components/sidebar/SidebarPrimitives';
import { TreeRow } from '../../components/TreeRow';
import { useProjectAssessments } from '../../hooks/useAssessments';
import { useChangeCasesByProject } from '../../hooks/useChangeCases';
import {
  flattenChangeCaseMembers,
  flattenRelationChangeCaseMembers
} from '../entities/components/snapshotDisplay';
import { useEntityCount } from '../../hooks/useEntities';
import { contentDownloadUrl, useContentScopeOperations } from '../../hooks/useContentScope';
import { useProject } from '../../hooks/useProjects';
import {
  asProjectPublicId,
  projectContentFolderRoute,
  projectDetailRoute,
  projectDiagramRoute,
  projectMarkdownRoute
} from '../../routes/publicObjectRoutes';
import type { ProjectSearchParams } from '../../routes/searchParams';
import styles from '../../shell/SidePanel.module.css';
import { downloadUrl } from '../../lib/browserDownload';
import { BaselineSidebarSection } from '../baselines/BaselineSidebarSection';
import { ProjectViewsPanel } from './ProjectViewsPanel';
import { useCreateProjectBaseline } from './shared/CreateProjectBaselineDialog';
import { useProjectContentCreateDialogs } from './useProjectContentCreateDialogs';

type ProjectSection = 'home' | 'entities' | 'plan' | 'assessments';
type SidebarTab = 'content' | 'views' | 'baselines';

export const ProjectContentSidebar = ({
  workspaceSlug,
  projectId
}: {
  workspaceSlug: string;
  projectId: string;
}) => {
  const scope = { kind: 'project' as const, workspaceId: workspaceSlug, projectId };
  const operations = useContentScopeOperations(scope);
  const { data: project } = useProject(workspaceSlug, projectId);
  const { data: entityCount } = useEntityCount(
    workspaceSlug,
    {
      projectId: project?.id,
      projectScope: 'project'
    },
    { enabled: project != null }
  );
  const { data: assessments = [] } = useProjectAssessments(workspaceSlug, projectId);
  const { data: changeCases = [] } = useChangeCasesByProject(workspaceSlug, projectId);
  // Distinct planned change cases, matching the count on the Plan screen's Planned changes tab.
  const futureChangeCount = new Set(
    [...flattenChangeCaseMembers(changeCases), ...flattenRelationChangeCaseMembers(changeCases)]
      .filter(entry => entry.changeCase.status === 'planned')
      .map(entry => entry.changeCase.id)
  ).size;
  const treeRef = useRef<ContentTreeHandle>(null);
  const [tab, setTab] = useState<SidebarTab>('content');
  const baseline = useCreateProjectBaseline(project);
  const navigate = useNavigate();
  const params = useParams({ strict: false });
  const search = useSearch({ strict: false }) as ProjectSearchParams;
  useEffect(() => {
    setTab(search.baselineId != null ? 'baselines' : 'content');
  }, [search.baselineId]);
  const section: ProjectSection =
    search.section === 'entities' || search.section === 'plan' || search.section === 'assessments'
      ? search.section
      : 'home';
  const contentFolder = section === 'home' ? (params._splat ?? null) : null;
  const activeFileId = params.nodeId ?? params.diagramId ?? null;

  const navigateProject = (next: { section?: ProjectSection; folder?: string }) => {
    const nextSection = next.section ?? section;
    const nextSearch = {
      tab: search.tab,
      section: nextSection,
      dialog: search.dialog,
      contentQuery: search.contentQuery,
      contentView: search.contentView
    };
    if (nextSection === 'home' && next.folder) {
      const folderSearch = {
        ...nextSearch,
        tab: search.tab === 'archive' ? search.tab : undefined,
        section: nextSection === 'home' ? undefined : nextSection
      };
      navigate(
        projectContentFolderRoute(
          workspaceSlug,
          asProjectPublicId(projectId),
          next.folder,
          folderSearch
        )
      );
    } else {
      navigate(projectDetailRoute(workspaceSlug, asProjectPublicId(projectId), nextSearch));
    }
  };
  const openFile = (file: ProjectFile) =>
    navigate(
      file.type === 'markdown'
        ? projectMarkdownRoute(workspaceSlug, asProjectPublicId(projectId), file.id)
        : projectDiagramRoute(workspaceSlug, asProjectPublicId(projectId), file.id)
    );
  const download = (file: ProjectFile) => {
    downloadUrl(contentDownloadUrl(scope, file.path), file.original_filename ?? file.name);
  };
  const createDialogs = useProjectContentCreateDialogs({ scope, operations, project, openFile });
  const openAddEntity = () => {
    const nextSearch = {
      tab: search.tab === 'archive' ? search.tab : undefined,
      section: 'entities' as const,
      dialog: 'add-entity' as const,
      contentQuery: search.contentQuery,
      contentView: search.contentView
    };
    if (contentFolder) {
      navigate(
        projectContentFolderRoute(
          workspaceSlug,
          asProjectPublicId(projectId),
          contentFolder,
          nextSearch
        )
      );
    } else {
      navigate(projectDetailRoute(workspaceSlug, asProjectPublicId(projectId), nextSearch));
    }
  };
  const contentRows = (
    <>
      <TreeRow
        testId="project-secondary-home"
        label="Home"
        icon={<TbHome size={13} />}
        active={section === 'home' && !contentFolder && !activeFileId}
        onClick={() => navigateProject({ section: 'home' })}
      />
      <TreeRow
        testId="project-secondary-entities"
        label={`Entities (${entityCount?.total ?? 0})`}
        icon={<TbBinaryTree2 size={13} />}
        active={section === 'entities'}
        onClick={() => navigateProject({ section: 'entities' })}
      />
      <TreeRow
        testId="project-secondary-plan"
        label={`Plan (${futureChangeCount})`}
        icon={<TbCalendarEvent size={13} />}
        active={section === 'plan'}
        onClick={() => navigateProject({ section: 'plan' })}
      />
      <TreeRow
        testId="project-secondary-assessments"
        label={`Assessments (${assessments.length})`}
        icon={<TbClipboardList size={13} />}
        active={section === 'assessments'}
        onClick={() => navigateProject({ section: 'assessments' })}
      />
    </>
  );

  return (
    <>
      <SidebarHeader
        actions={
          tab === 'content' ? (
            <MenuButton.Root>
              <MenuButton.Trigger
                element={
                  <button type="button" className={styles.action} title="Add">
                    <TbPlus size={13} />
                  </button>
                }
              />
              <MenuButton.Menu>
                <Menu.Item
                  disabled={!project?.canManageFiles}
                  leftSlot={<TbFolderOpen size={13} />}
                  onClick={() => createDialogs.openFolder(contentFolder)}
                >
                  New folder
                </Menu.Item>
                <Menu.Item
                  disabled={!project?.canManageFiles}
                  leftSlot={<TbPlus size={13} />}
                  onClick={() => createDialogs.openDiagram(contentFolder)}
                >
                  New diagram
                </Menu.Item>
                <Menu.Item
                  disabled={!project?.canManageFiles}
                  leftSlot={<TbUpload size={13} />}
                  onClick={() => treeRef.current?.openUpload(contentFolder)}
                >
                  Upload file
                </Menu.Item>
                <Menu.Item
                  disabled={!project?.canManageFiles}
                  leftSlot={<TbFileText size={13} />}
                  onClick={() => createDialogs.openMarkdown(contentFolder)}
                >
                  New wiki page
                </Menu.Item>
                <Menu.Item
                  disabled={!project?.canEdit}
                  leftSlot={<TbBinaryTree2 size={13} />}
                  onClick={openAddEntity}
                >
                  Add entity
                </Menu.Item>
              </MenuButton.Menu>
            </MenuButton.Root>
          ) : tab === 'baselines' ? (
            <MenuButton.Root>
              <MenuButton.Trigger
                element={
                  <button type="button" className={styles.action} title="Add">
                    <TbPlus size={13} />
                  </button>
                }
              />
              <MenuButton.Menu>
                <Menu.Item
                  disabled={!project?.canEdit}
                  leftSlot={<TbBookmark size={13} />}
                  onClick={baseline.open}
                >
                  Create baseline
                </Menu.Item>
              </MenuButton.Menu>
            </MenuButton.Root>
          ) : null
        }
      >
        <Tabs.Root value={tab} onValueChange={value => setTab(value as SidebarTab)}>
          <Tabs.List>
            <Tabs.Trigger value="content">Content</Tabs.Trigger>
            <Tabs.Trigger value="views">Views</Tabs.Trigger>
            <Tabs.Trigger value="baselines">Baselines</Tabs.Trigger>
          </Tabs.List>
        </Tabs.Root>
      </SidebarHeader>
      <div className={styles.scroll}>
        {tab === 'content' ? (
          <ContentTree
            ref={treeRef}
            rootFiles={project?.files.rootFiles ?? []}
            folders={project?.files.folders ?? []}
            activeFileId={activeFileId}
            activeFolder={contentFolder}
            operations={operations}
            initiallyExpanded
            beforeTree={contentRows}
            onFolderClick={folder => navigateProject({ section: 'home', folder })}
            onFileClick={openFile}
            onDownload={download}
            onCreateFolder={createDialogs.openFolder}
            onCreateDiagram={createDialogs.openDiagram}
            onCreateMarkdown={createDialogs.openMarkdown}
          />
        ) : tab === 'views' ? (
          <ProjectViewsPanel
            workspaceSlug={workspaceSlug}
            projectId={projectId}
            canEdit={project?.canEdit ?? false}
          />
        ) : (
          <BaselineSidebarSection
            workspaceSlug={workspaceSlug}
            kind="project"
            projectId={project?.id}
          />
        )}
      </div>
      {createDialogs.element}
      {baseline.element}
    </>
  );
};
