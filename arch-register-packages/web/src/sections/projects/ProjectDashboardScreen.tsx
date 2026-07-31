import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Button } from '@diagram-craft/app-components/Button';
import { MenuButton } from '@diagram-craft/app-components/MenuButton';
import { Menu } from '@diagram-craft/app-components/src/Menu';
import { TbDots, TbFileText, TbLayoutGrid, TbPencil, TbStar } from 'react-icons/tb';
import type { ProjectDetail as ProjectDetailData } from '@arch-register/api-types/projectContract';
import { ProjectMetaItem, ProjectScreenLayout } from './ProjectScreenLayout';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { MdxContext } from '../markdown/MdxContext';
import { DashboardGrid } from '../dashboard/DashboardGrid';
import { useProjectDashboard, useUpdateProjectDashboard } from '../../hooks/useProjectDashboard';
import { formatDate } from '../../utils/dateFormat';
import styles from './ProjectDetailScreen.module.css';

type Props = {
  project: ProjectDetailData;
  allFilesCount: number;
  folderCount: number;
  pinError: string;
  isUpdatingProject: boolean;
  onNavigateHome: () => void;
  onNavigateProject: () => void;
  onTogglePinned: () => void;
  onEdit: () => void;
  onEditMarkdownTemplates: () => void;
};

export const ProjectDashboardScreen = ({
  project,
  allFilesCount,
  folderCount,
  pinError,
  isUpdatingProject,
  onNavigateHome,
  onNavigateProject,
  onTogglePinned,
  onEdit,
  onEditMarkdownTemplates
}: Props) => {
  const navigate = useNavigate();
  const { workspaceSlug } = useWorkspaceContext();
  const [isEditing, setIsEditing] = useState(false);

  const { data: dashboard, isLoading } = useProjectDashboard(workspaceSlug, project.id);
  const updateDashboard = useUpdateProjectDashboard(workspaceSlug, project.id);

  const widgets = dashboard?.widgets ?? [];

  return (
    <ProjectScreenLayout
      breadcrumbs={[
        {
          label: 'Home',
          onClick: () => navigate({ to: '/$workspaceSlug', params: { workspaceSlug } })
        },
        { label: 'Projects', onClick: onNavigateHome },
        { label: project.name, onClick: onNavigateProject }
      ]}
      title={project.name}
      titleSuffix={
        project.canEdit ? (
          <button
            type="button"
            className={`${styles.pinBtn} ${project.pinned ? styles.pinBtnActive : ''}`}
            onClick={onTogglePinned}
            disabled={isUpdatingProject}
            title={project.pinned ? 'Unpin project' : 'Pin project'}
            aria-label={project.pinned ? 'Unpin project' : 'Pin project'}
          >
            <TbStar size={16} />
          </button>
        ) : null
      }
      description={project.description}
      error={pinError ? <div className={styles.errorText}>{pinError}</div> : undefined}
      actions={
        project.canEdit &&
        !isEditing && (
          <>
            <Button icon={<TbPencil size={12} />} onClick={onEdit}>
              Edit
            </Button>
          </>
        )
      }
      menu={
        project.canEdit &&
        !isEditing && (
          <MenuButton.Root>
            <MenuButton.Trigger
              element={
                <Button variant="ghost" aria-label="Project actions" icon={<TbDots size={16} />} />
              }
            />
            <MenuButton.Menu align="end">
              <Menu.Item leftSlot={<TbFileText size={13} />} onClick={onEditMarkdownTemplates}>
                Edit Markdown Templates
              </Menu.Item>
              <Menu.Item leftSlot={<TbLayoutGrid size={13} />} onClick={() => setIsEditing(true)}>
                Edit dashboard
              </Menu.Item>
            </MenuButton.Menu>
          </MenuButton.Root>
        )
      }
      meta={
        <>
          <ProjectMetaItem
            label="Project ID"
            value={<span className="mono tabular">{project.public_id}</span>}
          />
          <ProjectMetaItem
            label="Diagrams"
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
    >
      <MdxContext.Provider value={{ workspaceSlug, projectId: project.id }}>
        <DashboardGrid
          widgets={widgets}
          canEdit={project.canEdit}
          isEditing={isEditing}
          onEditingChange={setIsEditing}
          onSave={widgets => updateDashboard.mutate({ widgets })}
          isLoading={isLoading}
          workspaceSlug={workspaceSlug}
          surface="project"
        />
      </MdxContext.Provider>
    </ProjectScreenLayout>
  );
};
