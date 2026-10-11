import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { EntityDrawer } from '../entities/entityDrawer/EntityDrawer';
import { GovernanceCaseDrawer } from '../governance/GovernanceCaseDrawer';
import { AppDashboardScreen } from './AppDashboardScreen';
import { useApplications } from '../../hooks/useApplications';
import { findDashboardByKeyOrId } from '../../lib/applicationDashboards';

/**
 * Generic screen of the `apps/$appKey/$dashboardKey` route: renders the dashboard in the URL, plus
 * the dataset / governance-case drawers that review-queue widgets open through the `datasetId` and
 * `caseId` search params.
 */
export const AppDashboardRouteScreen = () => {
  const { workspaceSlug, appKey, dashboardKey } = useParams({ strict: false }) as {
    workspaceSlug: string;
    appKey: string;
    dashboardKey: string;
  };
  const { data: applications } = useApplications(workspaceSlug);
  const dashboard = findDashboardByKeyOrId(
    applications?.find(application => application.key === appKey)?.dashboards,
    dashboardKey
  );
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as Record<string, string | undefined>;

  const patchSearch = (patch: Record<string, string | undefined>) =>
    navigate({
      search: (previous: Record<string, unknown>) => ({ ...previous, ...patch })
    } as never);

  return (
    <>
      {dashboard && <AppDashboardScreen dashboardId={dashboard.id} />}
      {search.datasetId && (
        <EntityDrawer
          workspaceSlug={workspaceSlug}
          entityId={search.datasetId}
          onClose={() => patchSearch({ datasetId: undefined })}
          onOpenGovernanceCase={caseId => patchSearch({ datasetId: undefined, caseId })}
        />
      )}
      {search.caseId && (
        <GovernanceCaseDrawer
          entityNoun="dataset"
          workspaceSlug={workspaceSlug}
          caseId={search.caseId}
          onClose={() => patchSearch({ caseId: undefined })}
          onOpenDataset={datasetId => patchSearch({ caseId: undefined, datasetId })}
        />
      )}
    </>
  );
};
