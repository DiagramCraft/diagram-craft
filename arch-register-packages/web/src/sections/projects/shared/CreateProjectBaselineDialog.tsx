import { useNavigate } from '@tanstack/react-router';
import type { ProjectDetail as ProjectDetailData } from '@arch-register/api-types/projectCrudContract';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { asProjectPublicId, projectDetailRoute } from '../../../routes/publicObjectRoutes';
import { baselineContextSearch } from '../../baselines/baselineContext';
import { CreateBaselineDialog } from '../../baselines/CreateBaselineDialog';

/** Create-baseline dialog scoped to one project; opens the new baseline once it is created. */
export const CreateProjectBaselineDialog = ({
  project,
  open,
  onClose
}: {
  project: Pick<ProjectDetailData, 'id' | 'owner'>;
  open: boolean;
  onClose: () => void;
}) => {
  const navigate = useNavigate();
  const { workspaceSlug } = useWorkspaceContext();

  return (
    <CreateBaselineDialog
      open={open}
      onClose={onClose}
      workspaceSlug={workspaceSlug}
      scope={{ kind: 'project', projectId: project.id, projectScope: 'project' }}
      defaultOwnerTeamId={project.owner?.id}
      onCreated={baseline =>
        navigate(
          projectDetailRoute(workspaceSlug, asProjectPublicId(project.id), {
            section: 'entities',
            ...baselineContextSearch(baseline)
          })
        )
      }
    />
  );
};
