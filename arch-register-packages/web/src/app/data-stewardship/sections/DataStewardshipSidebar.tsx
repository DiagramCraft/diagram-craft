import { useMemo } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import {
  TbAlertTriangle,
  TbChecklist,
  TbCircleCheck,
  TbCircleDashed,
  TbClockHour4,
  TbDatabase,
  TbFlag,
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
  DS_ASSESSMENTS_ID,
  DS_CHANGE_CASES_ID,
  DS_CLASSIFICATION_ID,
  DS_MY_WORK_ID,
  DS_RAIL_PATHS,
  DS_SECTIONS,
  DS_SECTION_LABELS,
  DS_STEWARDSHIP_ID,
  type DataStewardshipRailItemId
} from '../dataStewardshipSections';
import { useDataStewardshipChangeCases } from '../dataStewardshipChangeCases';
import {
  DS_ASSESSMENT_STATUS_LABEL,
  type DataStewardshipAssessmentStatus
} from '../dataStewardshipAssessments';
import { useDataStewardshipAssessmentRows } from '../useDataStewardshipAssessmentRows';
import {
  queueItemPriority,
  useDataStewardshipQueue,
  type DataStewardshipQueuePriority,
  type DataStewardshipQueueScope
} from '../dataStewardshipQueue';
import { caseKindLabel } from '../../../utils/governanceCaseLabels';
import type {
  DataStewardshipAssessmentsSearchParams,
  DataStewardshipChangeCasesSearchParams,
  DataStewardshipClassificationSearchParams,
  DataStewardshipMyWorkSearchParams,
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

const PRIORITY_FACET_LABEL: Record<DataStewardshipQueuePriority, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low'
};

const SCOPE_FACET_LABEL: Record<DataStewardshipQueueScope, string> = {
  mine: 'Assigned to me',
  all: 'All open items',
  late: 'Past due'
};

/**
 * The My work section's own primary-sidebar content: scope tabs (mirroring the in-screen `Tabs`
 * on `DataStewardshipMyWorkScreen.tsx`, so either can drive the same `scope` search param), a Kind
 * facet (one row per governance case kind actually present in the current scope), and a derived
 * Priority facet (`queueItemPriority` — there is no real priority field on a governance case, see
 * `../dataStewardshipQueue.ts`). No Assignee facet: `governance.assignments.mine` only resolves an
 * assignment target for the current user's own tasks, so it can't be populated for "All open
 * items"/"Past due" — see #3298's plan.
 */
const MyWorkSidebarContent = ({
  workspaceSlug,
  dataStewardshipConfig
}: {
  workspaceSlug: string;
  dataStewardshipConfig: DataStewardshipConfig;
}) => {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as DataStewardshipMyWorkSearchParams;
  const scope: DataStewardshipQueueScope = search.scope ?? 'mine';

  const mineQueue = useDataStewardshipQueue(
    workspaceSlug,
    dataStewardshipConfig.dataEntitySchemaId,
    'mine'
  );
  const allQueue = useDataStewardshipQueue(
    workspaceSlug,
    dataStewardshipConfig.dataEntitySchemaId,
    'all'
  );
  const lateCount = allQueue.items.filter(
    item => item.case.dueAt != null && new Date(item.case.dueAt) < new Date()
  ).length;
  const scopeCounts: Record<DataStewardshipQueueScope, number> = {
    mine: mineQueue.items.length,
    all: allQueue.items.length,
    late: lateCount
  };

  const activeItems = scope === 'mine' ? mineQueue.items : allQueue.items;
  const kindCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of activeItems)
      counts.set(item.case.caseKind, (counts.get(item.case.caseKind) ?? 0) + 1);
    return counts;
  }, [activeItems]);
  const priorityCounts = useMemo(() => {
    const counts = new Map<DataStewardshipQueuePriority, number>();
    for (const item of activeItems) {
      const priority = queueItemPriority(item.case);
      counts.set(priority, (counts.get(priority) ?? 0) + 1);
    }
    return counts;
  }, [activeItems]);

  const patchSearch = (patch: Partial<DataStewardshipMyWorkSearchParams>) =>
    navigate({
      to: DS_RAIL_PATHS[DS_MY_WORK_ID],
      params: { workspaceSlug },
      search: (previous: Record<string, unknown>) => ({ ...previous, ...patch })
    });

  return (
    <>
      <SidebarGroupLabel>Scope</SidebarGroupLabel>
      {(['mine', 'all', 'late'] as const).map(scopeOption => (
        <TreeRow
          key={scopeOption}
          icon={<TbListCheck size={12} />}
          label={SCOPE_FACET_LABEL[scopeOption]}
          testId={`data-stewardship-my-work-facet-scope-${scopeOption}`}
          active={scope === scopeOption}
          onClick={() => patchSearch({ scope: scopeOption, kind: undefined, priority: undefined })}
          trailing={<span className="dim mono">{scopeCounts[scopeOption]}</span>}
        />
      ))}
      {kindCounts.size > 0 && (
        <>
          <SidebarGroupLabel>Kind</SidebarGroupLabel>
          {[...kindCounts.keys()].map(kind => (
            <TreeRow
              key={kind}
              icon={<TbDatabase size={12} />}
              label={caseKindLabel(kind, {})}
              testId={`data-stewardship-my-work-facet-kind-${kind}`}
              active={search.kind === kind}
              onClick={() => patchSearch({ kind: search.kind === kind ? undefined : kind })}
              trailing={<span className="dim mono">{kindCounts.get(kind) ?? 0}</span>}
            />
          ))}
        </>
      )}
      <SidebarGroupLabel>Priority</SidebarGroupLabel>
      {(['high', 'medium', 'low'] as const).map(priority => (
        <TreeRow
          key={priority}
          icon={<TbFlag size={12} />}
          label={PRIORITY_FACET_LABEL[priority]}
          testId={`data-stewardship-my-work-facet-priority-${priority}`}
          active={search.priority === priority}
          onClick={() =>
            patchSearch({ priority: search.priority === priority ? undefined : priority })
          }
          trailing={<span className="dim mono">{priorityCounts.get(priority) ?? 0}</span>}
        />
      ))}
    </>
  );
};

/**
 * The Change cases & exceptions section's own primary-sidebar content (#3301) — a status facet
 * over the `entity.change-case` register (there's no exceptions/waiver register any more — see
 * `DataStewardshipChangeCasesScreen.tsx`'s doc comment). Mirrors `MyWorkSidebarContent`'s "facet
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

const ASSESSMENT_STATUS_FACET_ICON: Record<
  DataStewardshipAssessmentStatus,
  typeof TbAlertTriangle
> = {
  overdue: TbAlertTriangle,
  in_progress: TbClockHour4,
  not_started: TbCircleDashed,
  complete: TbCircleCheck
};

/**
 * The Assessments section's own primary-sidebar content — the stat strip's four status buckets as
 * facets (All / Overdue / In progress / Not started / Complete), mirroring the Claude Design
 * reference's `DSSidebar` (`ds.jsx`) and this file's own Stewardship/Classification facet panels.
 * Replaces the toolbar's in-page status toggle that `DataStewardshipAssessmentsScreen.tsx` used
 * before this section had its own sidebar content, same "facet moves to the sidebar once the
 * section has one" shape those two screens already established.
 */
const AssessmentsSidebarContent = ({
  workspaceSlug,
  dataStewardshipConfig
}: {
  workspaceSlug: string;
  dataStewardshipConfig: DataStewardshipConfig;
}) => {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as DataStewardshipAssessmentsSearchParams;
  const { summaries } = useDataStewardshipAssessmentRows(
    workspaceSlug,
    dataStewardshipConfig.dataEntitySchemaId
  );

  const statusCounts = useMemo(() => {
    const counts = new Map<DataStewardshipAssessmentStatus, number>();
    for (const summary of summaries)
      counts.set(summary.status, (counts.get(summary.status) ?? 0) + 1);
    return counts;
  }, [summaries]);

  const patchSearch = (patch: Partial<DataStewardshipAssessmentsSearchParams>) =>
    navigate({
      to: DS_RAIL_PATHS[DS_ASSESSMENTS_ID],
      params: { workspaceSlug },
      search: (previous: Record<string, unknown>) => ({ ...previous, ...patch })
    });

  return (
    <>
      <TreeRow
        icon={<TbChecklist size={12} />}
        label="All"
        testId="data-stewardship-assessments-facet-all"
        active={!search.status}
        onClick={() => patchSearch({ status: undefined })}
        trailing={<span className="dim mono">{summaries.length}</span>}
      />
      {(Object.keys(DS_ASSESSMENT_STATUS_LABEL) as DataStewardshipAssessmentStatus[]).map(
        status => {
          const Icon = ASSESSMENT_STATUS_FACET_ICON[status];
          return (
            <TreeRow
              key={status}
              icon={<Icon size={12} />}
              label={DS_ASSESSMENT_STATUS_LABEL[status]}
              testId={`data-stewardship-assessments-facet-${status}`}
              active={search.status === status}
              onClick={() => patchSearch({ status: search.status === status ? undefined : status })}
              trailing={<span className="dim mono">{statusCounts.get(status) ?? 0}</span>}
            />
          );
        }
      )}
    </>
  );
};

/**
 * Section-dependent primary sidebar for the Data Stewardship app: navigation between the app's
 * five rail sections, gated on the `data-stewardship` capability configuration — mirrors
 * `../../vendor-management/sections/VendorManagementSidebar.tsx`'s `!enabled` empty state and its
 * fallback "Sections" nav list.
 *
 * Every section swaps in its own facet content (`MyWorkSidebarContent`,
 * `StewardshipSidebarContent`, `ClassificationSidebarContent`, `ChangeCasesSidebarContent`,
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
        ) : activeSection === DS_MY_WORK_ID ? (
          <MyWorkSidebarContent
            workspaceSlug={workspaceSlug}
            dataStewardshipConfig={dataStewardshipConfig}
          />
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
        ) : activeSection === DS_ASSESSMENTS_ID ? (
          <AssessmentsSidebarContent
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
