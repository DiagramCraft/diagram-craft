import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { EntityDrawer } from '../entities/entityDrawer/EntityDrawer';
import { GovernanceCaseDrawer } from '../governance/GovernanceCaseDrawer';
import { AppDashboardScreen } from './AppDashboardScreen';

/**
 * Generic screen of the `apps/$appKey/$dashboardId` route: renders the dashboard in the URL, plus
 * the dataset / governance-case drawers that review-queue widgets open through the `datasetId` and
 * `caseId` search params.
 */
export const AppDashboardRouteScreen = () => {
  const { workspaceSlug, dashboardId } = useParams({ strict: false }) as {
    workspaceSlug: string;
    dashboardId: string;
  };
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as Record<string, string | undefined>;

  const patchSearch = (patch: Record<string, string | undefined>) =>
    navigate({
      search: (previous: Record<string, unknown>) => ({ ...previous, ...patch })
    } as never);

  return (
    <>
      <AppDashboardScreen dashboardId={dashboardId} />
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
