import { useMemo } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { TbDatabase, TbLayersLinked, TbAlertTriangle, TbRoute, TbWorld } from 'react-icons/tb';
import {
  SidebarGroupLabel,
  SidebarTitleHeader
} from '../../../components/sidebar/SidebarPrimitives';
import { TreeRow } from '../../../components/TreeRow';
import { entitiesQuery } from '../../../queries/entities';
import { workspaceCapabilityConfigurationsQuery } from '../../../queries/workspaceConfig';
import { useSchemas } from '../../../hooks/useSchemas';
import {
  resolveDataStewardshipConfig,
  type DataStewardshipConfig
} from '../dataStewardshipQueries';
import { computeDatasetCoverage } from '../datasetCoverage';
import { useDataFlowConfig } from '../useDataFlowConfig';
import {
  DS_CLASSIFICATION_ID,
  DS_RAIL_PATHS,
  DS_SECTIONS,
  DS_STEWARDSHIP_ID,
  type DataStewardshipRailItemId
} from '../dataStewardshipSections';
import type {
  DataStewardshipClassificationSearchParams,
  DataStewardshipStewardshipSearchParams
} from '../../../routes/searchParams';
import styles from '../../../shell/SidePanel.module.css';

/**
 * The Stewardship section's own primary-sidebar content: an "all datasets" / "with a gap" toggle
 * and a Classification facet — mirrors `RisksSidebarContent` in
 * `../../risk-compliance/sections/RiskComplianceSidebar.tsx`'s facet/count panel (though unlike
 * that one, this doesn't also list every dataset individually — the dataset table is the place to
 * browse datasets one by one), replacing the plain "Sections" nav list for this section only.
 */
const StewardshipSidebarContent = ({
  workspaceSlug,
  dataStewardshipConfig
}: {
  workspaceSlug: string;
  dataStewardshipConfig: DataStewardshipConfig;
}) => {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as DataStewardshipStewardshipSearchParams;
  const { data: schemas } = useSchemas(workspaceSlug);
  const dataEntitySchema = schemas?.find(
    schema => schema.id === dataStewardshipConfig.dataEntitySchemaId
  );

  const { data: datasetsData } = useQuery(
    entitiesQuery(workspaceSlug, {
      schemaId: dataStewardshipConfig.dataEntitySchemaId,
      view: 'full',
      limit: 500
    })
  );
  const datasets = datasetsData?.items ?? [];

  const classificationOptions = useMemo(() => {
    const field = dataEntitySchema?.fields.find(candidate => candidate.id === 'classification');
    return field && field.type === 'select' ? (field.options ?? []) : [];
  }, [dataEntitySchema]);

  const classificationCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const dataset of datasets) {
      const value = dataset.classification;
      if (typeof value === 'string' && value) counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    return counts;
  }, [datasets]);

  const gapCount = useMemo(
    () =>
      datasets.filter(
        dataset =>
          !computeDatasetCoverage({
            owner: dataset._owner,
            steward: dataset.steward,
            classification: dataset.classification,
            reviewStatus: dataset.review_status
          }).dsCovered
      ).length,
    [datasets]
  );

  const patchSearch = (patch: Partial<DataStewardshipStewardshipSearchParams>) =>
    navigate({
      to: DS_RAIL_PATHS[DS_STEWARDSHIP_ID],
      params: { workspaceSlug },
      search: (previous: Record<string, unknown>) => ({ ...previous, ...patch })
    });

  const hasAnySelection = !!search.classification || !!search.gapsOnly;
  const clearAll = () => patchSearch({ classification: undefined, gapsOnly: undefined });

  return (
    <>
      <TreeRow
        icon={<TbDatabase size={12} />}
        label="All datasets"
        testId="data-stewardship-facet-all"
        active={!hasAnySelection}
        onClick={clearAll}
        trailing={<span className="dim mono">{datasets.length}</span>}
      />
      <TreeRow
        icon={<TbAlertTriangle size={12} />}
        label="With a coverage gap"
        testId="data-stewardship-facet-gaps"
        active={!!search.gapsOnly}
        onClick={() => patchSearch({ gapsOnly: search.gapsOnly ? undefined : '1' })}
        trailing={<span className="dim mono">{gapCount}</span>}
      />
      <SidebarGroupLabel>Classification</SidebarGroupLabel>
      {classificationOptions.map(option => (
        <TreeRow
          key={option.value}
          icon={<TbLayersLinked size={12} />}
          label={option.label}
          testId={`data-stewardship-facet-classification-${option.value}`}
          active={search.classification === option.value}
          onClick={() =>
            patchSearch({
              classification: search.classification === option.value ? undefined : option.value
            })
          }
          trailing={<span className="dim mono">{classificationCounts.get(option.value) ?? 0}</span>}
        />
      ))}
    </>
  );
};

/**
 * The Classification section's own primary-sidebar content: `TreeRow`s switching between its three
 * views (classified data / restricted flows / cross-boundary transfers) — this drives
 * `search.view` for `DataStewardshipClassificationScreen.tsx`, which has no in-screen tab strip —
 * plus the same Classification facet block as `StewardshipSidebarContent` above, always shown
 * since `ClassifiedDataView` is the default view. The flow-dependent rows are annotated when Data
 * Flow relations aren't available in this workspace (`useDataFlowConfig`), as an at-a-glance
 * signal before the user even clicks in — the view itself still renders the "not configured"
 * notice regardless.
 */
const ClassificationSidebarContent = ({
  workspaceSlug,
  dataStewardshipConfig
}: {
  workspaceSlug: string;
  dataStewardshipConfig: DataStewardshipConfig;
}) => {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as DataStewardshipClassificationSearchParams;
  const { data: schemas } = useSchemas(workspaceSlug);
  const dataEntitySchema = schemas?.find(
    schema => schema.id === dataStewardshipConfig.dataEntitySchemaId
  );
  const dataFlowConfig = useDataFlowConfig(workspaceSlug);

  const { data: datasetsData } = useQuery(
    entitiesQuery(workspaceSlug, {
      schemaId: dataStewardshipConfig.dataEntitySchemaId,
      view: 'full',
      limit: 500
    })
  );
  const datasets = datasetsData?.items ?? [];

  const classificationOptions = useMemo(() => {
    const field = dataEntitySchema?.fields.find(candidate => candidate.id === 'classification');
    return field && field.type === 'select' ? (field.options ?? []) : [];
  }, [dataEntitySchema]);

  const classificationCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const dataset of datasets) {
      const value = dataset.classification;
      if (typeof value === 'string' && value) counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    return counts;
  }, [datasets]);

  const patchSearch = (patch: Partial<DataStewardshipClassificationSearchParams>) =>
    navigate({
      to: DS_RAIL_PATHS[DS_CLASSIFICATION_ID],
      params: { workspaceSlug },
      search: (previous: Record<string, unknown>) => ({ ...previous, ...patch })
    });

  const view = search.view ?? 'classified';
  const notConfigured = !dataFlowConfig.data;

  return (
    <>
      <TreeRow
        icon={<TbDatabase size={12} />}
        label="Classified data"
        testId="data-stewardship-classification-view-classified"
        active={view === 'classified'}
        onClick={() => patchSearch({ view: undefined })}
        trailing={<span className="dim mono">{datasets.length}</span>}
      />
      <TreeRow
        icon={<TbRoute size={12} />}
        label="Restricted flows"
        testId="data-stewardship-classification-view-restricted-flows"
        active={view === 'restricted-flows'}
        onClick={() => patchSearch({ view: 'restricted-flows' })}
        trailing={notConfigured && <span className="dim">not configured</span>}
      />
      <TreeRow
        icon={<TbWorld size={12} />}
        label="Cross-boundary transfers"
        testId="data-stewardship-classification-view-cross-boundary"
        active={view === 'cross-boundary'}
        onClick={() => patchSearch({ view: 'cross-boundary' })}
        trailing={notConfigured && <span className="dim">not configured</span>}
      />
      <SidebarGroupLabel>Classification</SidebarGroupLabel>
      {classificationOptions.map(option => (
        <TreeRow
          key={option.value}
          icon={<TbLayersLinked size={12} />}
          label={option.label}
          testId={`data-stewardship-classification-facet-${option.value}`}
          active={search.classification === option.value}
          onClick={() =>
            patchSearch({
              classification: search.classification === option.value ? undefined : option.value
            })
          }
          trailing={<span className="dim mono">{classificationCounts.get(option.value) ?? 0}</span>}
        />
      ))}
    </>
  );
};

/**
 * Section-dependent primary sidebar for the Data Stewardship app: navigation between the app's
 * five rail sections, gated on the `data-stewardship` capability configuration — mirrors
 * `../../vendor-management/sections/VendorManagementSidebar.tsx`'s `!enabled` empty state and its
 * fallback "Sections" nav list.
 *
 * Stewardship and Classification swap in their own facet content (`StewardshipSidebarContent`,
 * `ClassificationSidebarContent`) once enabled. My work / Change cases & exceptions / Assessments
 * still render only the shared nav list for now — their real facet content (review-queue facets,
 * case status facets) lands alongside each section's own content in later sub-issues of #3152,
 * mirroring how `VendorManagementSidebar` grew its own facet content incrementally after its
 * scaffold.
 */
export const DataStewardshipSidebar = ({
  workspaceSlug,
  activeSection
}: {
  workspaceSlug: string;
  activeSection: DataStewardshipRailItemId;
}) => {
  const navigate = useNavigate();
  const { data: configurations } = useQuery(workspaceCapabilityConfigurationsQuery(workspaceSlug));
  const dataStewardshipConfig = resolveDataStewardshipConfig(configurations);

  return (
    <>
      <SidebarTitleHeader title="Data Stewardship" />
      <div className={styles.scroll}>
        {!dataStewardshipConfig ? (
          <div className={`${styles.emptyState} dim`}>Data stewardship is not enabled.</div>
        ) : activeSection === DS_STEWARDSHIP_ID ? (
          <StewardshipSidebarContent
            workspaceSlug={workspaceSlug}
            dataStewardshipConfig={dataStewardshipConfig}
          />
        ) : activeSection === DS_CLASSIFICATION_ID ? (
          <ClassificationSidebarContent
            workspaceSlug={workspaceSlug}
            dataStewardshipConfig={dataStewardshipConfig}
          />
        ) : (
          <>
            <SidebarGroupLabel>Sections</SidebarGroupLabel>
            {DS_SECTIONS.map(section => (
              <TreeRow
                key={section.id}
                label={section.label}
                testId={`data-stewardship-nav-${section.id}`}
                active={section.id === activeSection}
                onClick={() =>
                  navigate({
                    to: DS_RAIL_PATHS[section.id],
                    params: { workspaceSlug }
                  })
                }
              />
            ))}
          </>
        )}
      </div>
    </>
  );
};
