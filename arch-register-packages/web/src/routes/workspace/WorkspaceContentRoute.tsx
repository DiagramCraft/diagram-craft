import { getRouteApi } from '@tanstack/react-router';
import { WorkspaceContentScreen } from '../../sections/workspace-content/WorkspaceContentScreen';

const contentRouteApi = getRouteApi('/authenticated/$workspaceSlug/content');

export const WorkspaceContentRoute = () => {
  const { workspaceSlug } = contentRouteApi.useParams();
  const search = contentRouteApi.useSearch();

  return (
    <WorkspaceContentScreen workspaceSlug={workspaceSlug} folder={search.contentFolder ?? ''} />
  );
};
