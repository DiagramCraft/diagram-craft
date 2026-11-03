import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Button } from '@diagram-craft/app-components/Button';
import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import { TitleMenu } from '../../../components/TitleMenu';
import { TbBookmark, TbFileText, TbPencil, TbStar, TbTrash } from 'react-icons/tb';
import type { ProjectDetail as ProjectDetailData } from '@arch-register/api-types/projectCrudContract';
import { ProjectMetaItem, ProjectScreenLayout } from '../shared/ProjectScreenLayout';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { useCreateProjectBaseline } from '../shared/CreateProjectBaselineDialog';
import { MdxContext } from '../../markdown/MdxContext';
import { DashboardGrid } from '../../dashboard/DashboardGrid';
import { useProjectDashboard, useUpdateProjectDashboard } from '../../../hooks/useProjectDashboard';
import { useDeleteProject, useUpdateProject } from '../../../hooks/useProjects';
import { getErrorMessage } from '../../../lib/http';
import { formatDate } from '../../../utils/dateFormat';
import { ProjectSettingsForm } from './ProjectSettingsForm';
import { ProjectMarkdownTemplatesDialog } from './ProjectMarkdownTemplatesDialog';
import styles from './ProjectHome.module.css';

type Props = {
  project: ProjectDetailData;
  allFilesCount: number;
  folderCount: number;
};

export const ProjectHome = ({ project, allFilesCount, folderCount }: Props) => {
  const navigate = useNavigate();
  const { workspaceSlug, teams } = useWorkspaceContext();
  // Dashboard edit mode
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const [markdownTemplatesOpen, setMarkdownTemplatesOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pinError, setPinError] = useState('');
  const updateProject = useUpdateProject(workspaceSlug);
  const deleteProject = useDeleteProject(workspaceSlug);
  const baseline = useCreateProjectBaseline(project);

  const { data: dashboard, isLoading } = useProjectDashboard(workspaceSlug, project.id);
  const updateDashboard = useUpdateProjectDashboard(workspaceSlug, project.id);

  const widgets = dashboard?.widgets ?? [];

  const handleTogglePinned = () => {
    setPinError('');
    updateProject.mutate(
      {
        projectId: project.public_id,
        data: {
          name: project.name,
          description: project.description,
          owner: project.owner?.id ?? null,
          pinned: !project.pinned
        }
      },
      {
        onError: err => setPinError(getErrorMessage(err, 'Could not update project status'))
      }
    );
  };

  const handleDelete = () => {
    setConfirmDelete(false);
    setPinError('');
    deleteProject.mutate(project.id, {
      onSuccess: () => navigate({ to: '/$workspaceSlug/projects', params: { workspaceSlug } }),
      onError: err => setPinError(getErrorMessage(err, 'Could not delete project'))
    });
  };

  return (
    <ProjectScreenLayout
      projectName={project.name}
      title={project.name}
      titleSuffix={
        project.canEdit ? (
          <button
            type="button"
            className={`${styles.pinBtn} ${project.pinned ? styles.pinBtnActive : ''}`}
            onClick={handleTogglePinned}
            disabled={updateProject.isPending}
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
          <Button icon={<TbPencil size={12} />} onClick={() => setIsEditing(true)}>
            Edit
          </Button>
        )
      }
      menu={
        project.canEdit &&
        !isEditing && (
          <TitleMenu
            label="Project actions"
            items={[
              {
                label: 'Edit Markdown Templates',
                icon: <TbFileText size={13} />,
                onClick: () => setMarkdownTemplatesOpen(true)
              },
              {
                label: 'Create project baseline',
                icon: <TbBookmark size={13} />,
                onClick: baseline.open
              },
              {
                label: 'Edit project',
                icon: <TbPencil size={13} />,
                onClick: () => setIsEditingSettings(true)
              },
              {
                label: 'Delete project',
                icon: <TbTrash size={13} />,
                danger: true,
                separatorBefore: true,
                onClick: () => setConfirmDelete(true)
              }
            ]}
          />
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
          <ProjectMetaItem label="Start date" value={formatDate(project.start_date)} />
          <ProjectMetaItem label="Target date" value={formatDate(project.target_date)} />
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
      {isEditingSettings && project.canEdit && (
        <ProjectSettingsForm
          project={project}
          workspaceId={workspaceSlug}
          teams={teams}
          onSaved={() => setIsEditingSettings(false)}
          onClose={() => setIsEditingSettings(false)}
        />
      )}
      {project.canEdit && (
        <ProjectMarkdownTemplatesDialog
          open={markdownTemplatesOpen}
          project={project}
          workspaceId={workspaceSlug}
          onClose={() => setMarkdownTemplatesOpen(false)}
        />
      )}
      <DeleteConfirmationDialog
        open={confirmDelete}
        title="Delete project?"
        message={
          <>
            The project <b>{project.name}</b> and all its diagrams will be permanently deleted.
          </>
        }
        detail="This can't be undone."
        confirmLabel="Delete project"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
      {baseline.element}
    </ProjectScreenLayout>
  );
};
