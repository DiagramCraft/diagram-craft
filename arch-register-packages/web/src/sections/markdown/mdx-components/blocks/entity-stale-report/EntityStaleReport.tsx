import { useWorkspaceContext } from '../../../../../layouts/WorkspaceContext';
import { StaleEntityReport } from '../../../../workspace-settings/sub-sections/analytics/StaleEntityReport';
import type { EntityStaleReportProps } from './types';

export const EntityStaleReport = ({ staleAfterDays }: EntityStaleReportProps) => {
  const { workspaceSlug } = useWorkspaceContext();

  return (
    <StaleEntityReport workspaceSlug={workspaceSlug} initialStaleAfterDays={staleAfterDays ?? 90} />
  );
};
