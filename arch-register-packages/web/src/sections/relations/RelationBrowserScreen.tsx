import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { RelationBrowser } from './RelationBrowser';

export const RelationBrowserScreen = () => {
  const { workspaceSlug } = useWorkspaceContext();
  return <RelationBrowser workspaceId={workspaceSlug} />;
};

export default RelationBrowserScreen;
