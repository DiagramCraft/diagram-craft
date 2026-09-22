import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { ToggleButtonGroup } from '@diagram-craft/app-components/ToggleButtonGroup';
import { Title } from '../../../components/Title';
import { workspaceCapabilityConfigurationsQuery } from '../../../queries/workspaceConfig';
import { useSchemas } from '../../../hooks/useSchemas';
import { resolveDataStewardshipConfig } from '../dataStewardshipQueries';
import { useDataFlowConfig } from '../useDataFlowConfig';
import { DS_CLASSIFICATION_ID, DS_RAIL_PATHS } from '../dataStewardshipSections';
import type { DataStewardshipClassificationSearchParams } from '../../../routes/searchParams';
import { ClassifiedDataView } from './ClassifiedDataView';
import { RestrictedFlowsView } from './RestrictedFlowsView';
import { CrossBoundaryTransfersView } from './CrossBoundaryTransfersView';
import { DatasetDrawer } from './DatasetDrawer';
import styles from './DataStewardshipStewardshipScreen.module.css';

/**
 * The Classification section: three views — classified data, restricted flows, and cross-boundary
 * transfers — switched via an in-screen `ToggleButtonGroup` (mirrors the Claude Design reference's
 * `DSClassification`'s own `ds-seg` segmented control in `ds-views.jsx`, and this codebase's own
 * `../../risk-compliance/sections/RiskComplianceControlsScreen.tsx` view toggle). The sidebar
 * (`ClassificationSidebarContent` in `DataStewardshipSidebar.tsx`) carries dataset facets only —
 * per the design reference, Stewardship and Classification share one sidebar shape, and the view
 * switch lives in the screen, not the sidebar. The switcher renders *below* each view's own stat
 * tiles, matching the design reference's layout (`ds-stats` above `ar-toolbar`'s `ds-seg`) — built
 * here and passed down as `viewSwitcher` so each view can place it after its own tiles rather than
 * the screen pinning it above all three views' content.
 *
 * Restricted flows and cross-boundary transfers both depend on Data Flow relations (#3065), which
 * exist at the model layer but have no dedicated app (#3150) or capability binding yet — see
 * `../useDataFlowConfig.ts` for how "configured" is detected. When absent, both views render a
 * plain notice instead of an empty table, per the issue's explicit requirement. Per-dataset flow
 * linkage inside the Data Entity drawer is intentionally out of scope here — the drawer does not
 * expose flow or system sections until those relationships have supported drawer providers.
 */
export const DataStewardshipClassificationScreen = () => {
  const { workspaceSlug } = useParams({ strict: false }) as { workspaceSlug: string };
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as DataStewardshipClassificationSearchParams;
  const view = search.view ?? 'classified';

  const configurations = useQuery(workspaceCapabilityConfigurationsQuery(workspaceSlug));
  const dataStewardshipConfig = resolveDataStewardshipConfig(configurations.data);
  const dataFlowConfig = useDataFlowConfig(workspaceSlug);
  const schemas = useSchemas(workspaceSlug);
  const dataEntitySchema = schemas.data?.find(
    schema => schema.id === dataStewardshipConfig?.dataEntitySchemaId
  );

  const patchSearch = (patch: Partial<DataStewardshipClassificationSearchParams>) =>
    navigate({
      to: DS_RAIL_PATHS[DS_CLASSIFICATION_ID],
      params: { workspaceSlug },
      search: (previous: Record<string, unknown>) => ({ ...previous, ...patch })
    });
  const openDataset = (id: string) => patchSearch({ datasetId: id });
  const closeDataset = () => patchSearch({ datasetId: undefined });

  if (configurations.isLoading) {
    return <div className={styles.empty}>Loading data stewardship…</div>;
  }
  if (!dataStewardshipConfig) {
    return (
      <div className={styles.empty}>
        Data stewardship is not enabled. Configure the data stewardship capability in workspace
        settings.
      </div>
    );
  }

  const viewSwitcher: ReactNode = (
    <ToggleButtonGroup.Root
      type="single"
      aria-label="Classification view"
      value={view}
      onChange={value => {
        if (value)
          patchSearch({
            view:
              value === 'classified' ? undefined : (value as 'restricted-flows' | 'cross-boundary')
          });
      }}
    >
      <ToggleButtonGroup.Item value="classified">Classified data</ToggleButtonGroup.Item>
      <ToggleButtonGroup.Item value="restricted-flows">Restricted flows</ToggleButtonGroup.Item>
      <ToggleButtonGroup.Item value="cross-boundary">
        Cross-boundary transfers
      </ToggleButtonGroup.Item>
    </ToggleButtonGroup.Root>
  );

  return (
    <div className={styles.screen}>
      <Title
        title="Classification"
        description="Datasets by classification, restricted integration flows, and cross-boundary transfers that carry personal data without a recorded safeguard."
      />

      {view === 'restricted-flows' ? (
        <RestrictedFlowsView
          workspaceSlug={workspaceSlug}
          dataFlowConfig={dataFlowConfig.data}
          openDataset={openDataset}
          viewSwitcher={viewSwitcher}
        />
      ) : view === 'cross-boundary' ? (
        <CrossBoundaryTransfersView
          workspaceSlug={workspaceSlug}
          dataFlowConfig={dataFlowConfig.data}
          openDataset={openDataset}
          viewSwitcher={viewSwitcher}
        />
      ) : (
        <ClassifiedDataView
          workspaceSlug={workspaceSlug}
          dataStewardshipConfig={dataStewardshipConfig}
          dataEntitySchema={dataEntitySchema}
          search={search}
          patchSearch={patchSearch}
          openDataset={openDataset}
          viewSwitcher={viewSwitcher}
        />
      )}

      {search.datasetId && (
        <DatasetDrawer
          workspaceSlug={workspaceSlug}
          datasetId={search.datasetId}
          onClose={closeDataset}
        />
      )}
    </div>
  );
};
