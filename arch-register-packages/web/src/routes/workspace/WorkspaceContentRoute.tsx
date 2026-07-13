import { useParams } from '@tanstack/react-router';
import { WorkspaceContentScreen } from '../../sections/workspace-content/WorkspaceContentScreen';

export const WorkspaceContentRoute = () => {
  const { workspaceSlug } = useParams({ strict: false });

  return <WorkspaceContentScreen workspaceSlug={workspaceSlug!} folder="" />;
};

export const WorkspaceContentFolderRoute = () => {
  const { workspaceSlug, _splat } = useParams({ strict: false });

  return <WorkspaceContentScreen workspaceSlug={workspaceSlug!} folder={_splat ?? ''} />;
};
