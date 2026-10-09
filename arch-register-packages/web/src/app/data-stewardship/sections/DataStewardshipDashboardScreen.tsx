import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { AppDashboardScreen } from '../../../sections/dashboard/AppDashboardScreen';
import { EntityDrawer } from '../../../sections/entities/entityDrawer/EntityDrawer';
import type { DataStewardshipMyWorkSearchParams } from '../../../routes/searchParams';
import { dataStewardshipAppDefinition } from '../dataStewardshipShell';
import { DS_MY_WORK_ID, DS_RAIL_PATHS } from '../dataStewardshipSections';
import { GovernanceCaseDrawer } from '../../../sections/governance/GovernanceCaseDrawer';

/**
 * `AppRailSection.dashboard.appKey` (declared once in `dataStewardshipShell.tsx`) is the source of
 * truth this screen renders (#3469, as in `GlossaryDashboardScreen.tsx`).
 */
const sectionDashboardAppKey = (): string => {
  const appKey = dataStewardshipAppDefinition.sections.find(section => section.id === DS_MY_WORK_ID)
    ?.dashboard?.appKey;
  if (!appKey) throw new Error('Data Stewardship My work section has no dashboard.appKey');
  return appKey;
};

/**
 * The Data Stewardship "My work" landing screen (#3298), now a configurable dashboard (#3501).
 * The widgets open governance cases by setting the `caseId` search param; this screen hosts the
 * case drawer (and the dataset drawer it links through to), which stay outside widget scope.
 */
export const DataStewardshipDashboardScreen = () => {
  const { workspaceSlug } = useParams({ strict: false }) as { workspaceSlug: string };
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as DataStewardshipMyWorkSearchParams;

  const patchSearch = (patch: Partial<DataStewardshipMyWorkSearchParams>) =>
    navigate({
      to: DS_RAIL_PATHS[DS_MY_WORK_ID],
      params: { workspaceSlug },
      search: (previous: Record<string, unknown>) => ({ ...previous, ...patch })
    });

  return (
    <>
      <AppDashboardScreen appKey={sectionDashboardAppKey()} />
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
