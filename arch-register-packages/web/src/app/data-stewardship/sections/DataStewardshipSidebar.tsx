import { useMemo } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import {
  TbAlertTriangle,
  TbCircleDashed,
  TbDatabase,
  TbLayersLinked,
  TbListCheck,
  TbUser
} from 'react-icons/tb';
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
import { isPersonalData } from '../dataFlowClassification';
import {
  DS_CHANGE_CASES_ID,
  DS_CLASSIFICATION_ID,
  DS_RAIL_PATHS,
  DS_SECTIONS,
  DS_SECTION_LABELS,
  DS_STEWARDSHIP_ID,
  type DataStewardshipRailItemId
} from '../dataStewardshipSections';
import { useDataStewardshipChangeCases } from '../dataStewardshipChangeCases';
import type {
  DataStewardshipChangeCasesSearchParams,
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
 * The Classification section's own primary-sidebar content — dataset facets, not a view switcher:
 * per the Claude Design reference's `DSSidebar` (`ds.jsx`), Stewardship and Classification share
 * one sidebar shape (all datasets / with-a-gap / holds-personal-data toggles, then a Classification
 * facet); the three-view switch (classified data / restricted flows / cross-boundary transfers)
 * lives in the screen itself as a `ToggleButtonGroup`, not here — see
 * `DataStewardshipClassificationScreen.tsx`. "Holds personal data" is derived from `classification`
 * (`isPersonalData` in `../dataFlowClassification.ts`), same as the design reference's `d.personal`
 * flag — Data Entity has no dedicated field for it.
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
  const personalDataCount = useMemo(
    () => datasets.filter(dataset => isPersonalData(dataset.classification)).length,
    [datasets]
  );

  const patchSearch = (patch: Partial<DataStewardshipClassificationSearchParams>) =>
    navigate({
      to: DS_RAIL_PATHS[DS_CLASSIFICATION_ID],
      params: { workspaceSlug },
      search: (previous: Record<string, unknown>) => ({ ...previous, ...patch })
    });

  const hasAnySelection = !!search.classification || !!search.gapsOnly || !!search.personalDataOnly;
  const clearAll = () =>
    patchSearch({ classification: undefined, gapsOnly: undefined, personalDataOnly: undefined });

  return (
    <>
      <TreeRow
        icon={<TbDatabase size={12} />}
        label="All datasets"
        testId="data-stewardship-classification-facet-all"
        active={!hasAnySelection}
        onClick={clearAll}
        trailing={<span className="dim mono">{datasets.length}</span>}
      />
      <TreeRow
        icon={<TbAlertTriangle size={12} />}
        label="With a coverage gap"
        testId="data-stewardship-classification-facet-gaps"
        active={!!search.gapsOnly}
        onClick={() => patchSearch({ gapsOnly: search.gapsOnly ? undefined : '1' })}
        trailing={<span className="dim mono">{gapCount}</span>}
      />
      <TreeRow
        icon={<TbUser size={12} />}
        label="Holds personal data"
        testId="data-stewardship-classification-facet-personal"
        active={!!search.personalDataOnly}
        onClick={() => patchSearch({ personalDataOnly: search.personalDataOnly ? undefined : '1' })}
        trailing={<span className="dim mono">{personalDataCount}</span>}
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
 * The Change cases & exceptions section's own primary-sidebar content (#3301) — a status facet
 * over the `entity.change-case` register (there's no exceptions/waiver register any more — see
 * `DataStewardshipChangeCasesScreen.tsx`'s doc comment). Mirrors the "facet
 * drives the same search param as the in-screen control" shape.
 */
const ChangeCasesSidebarContent = ({
  workspaceSlug,
  dataStewardshipConfig
}: {
  workspaceSlug: string;
  dataStewardshipConfig: DataStewardshipConfig;
}) => {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as DataStewardshipChangeCasesSearchParams;

  const changeCases = useDataStewardshipChangeCases(
    workspaceSlug,
    dataStewardshipConfig.dataEntitySchemaId
  );

  const caseStatusCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of changeCases.rows)
      counts.set(row.case.status, (counts.get(row.case.status) ?? 0) + 1);
    return counts;
  }, [changeCases.rows]);

  const patchSearch = (patch: Partial<DataStewardshipChangeCasesSearchParams>) =>
    navigate({
      to: DS_RAIL_PATHS[DS_CHANGE_CASES_ID],
      params: { workspaceSlug },
      search: (previous: Record<string, unknown>) => ({ ...previous, ...patch })
    });

  return (
    <>
      <TreeRow
        icon={<TbListCheck size={12} />}
        label="All change cases"
        testId="data-stewardship-change-cases-facet-all"
        active={!search.status}
        onClick={() => patchSearch({ status: undefined })}
        trailing={<span className="dim mono">{changeCases.rows.length}</span>}
      />
      <SidebarGroupLabel>Status</SidebarGroupLabel>
      {(['open', 'completed', 'cancelled'] as const).map(status => (
        <TreeRow
          key={status}
          icon={<TbCircleDashed size={12} />}
          label={status}
          testId={`data-stewardship-change-cases-facet-status-${status}`}
          active={search.status === status}
          onClick={() => patchSearch({ status: search.status === status ? undefined : status })}
          trailing={<span className="dim mono">{caseStatusCounts.get(status) ?? 0}</span>}
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
 * Every section swaps in its own facet content (`StewardshipSidebarContent`, `ClassificationSidebarContent`, `ChangeCasesSidebarContent`,
 * `AssessmentsSidebarContent`) once enabled — mirroring how `VendorManagementSidebar` grew its own
 * facet content incrementally after its scaffold.
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
      <SidebarTitleHeader title={DS_SECTION_LABELS[activeSection]} />
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
        ) : activeSection === DS_CHANGE_CASES_ID ? (
          <ChangeCasesSidebarContent
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
