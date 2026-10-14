import { useWorkspaceContext } from '../../../../layouts/WorkspaceContext';
import { StaleEntityReport } from '../../../workspace-settings/sub-sections/analytics/StaleEntityReport';
import type { EntityStaleReportProps } from './types';

export const EntityStaleReport = ({ config }: { config: EntityStaleReportProps }) => {
  const { workspaceSlug } = useWorkspaceContext();

  return (
    <StaleEntityReport
      workspaceSlug={workspaceSlug}
      initialStaleAfterDays={config.staleAfterDays ?? 90}
    />
  );
};
