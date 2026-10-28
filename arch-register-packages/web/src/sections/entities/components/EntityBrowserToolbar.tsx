import { TbHistory } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type {
  WorkspaceLifecycleState,
  WorkspaceOwnerOption
} from '@arch-register/api-types/workspaceContract';
import type { WorkspaceEnum } from '@arch-register/api-types/enumContract';
import type {
  BrowserView,
  ColumnRenderConfig,
  FilterCondition
} from '@arch-register/api-types/viewContract';
import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
import type { Assessment } from '@arch-register/api-types/assessmentContract';
import { FilterDropdown } from '../../../components/FilterDropdown';
import styles from './EntityBrowser.module.css';
import { ManageFieldsPopover } from './ManageFieldsPopover';
import { AssessmentJoinPicker } from './AssessmentJoinPicker';
import { ViewHelpPopover } from './ViewHelpPopover';
import { QueryModeControls } from './QueryModeControls';
import type { EntityDisplayField } from './entityDisplayFields';
import type { AssessmentJoinOption } from './useJoinedAssessment';

const ALL_VIEW_OPTIONS = [
  { value: 'table', label: 'Table' },
  { value: 'cards', label: 'Cards' },
  { value: 'tree', label: 'Tree' },
  { value: 'radar', label: 'Radar' },
  { value: 'bubble-chart', label: 'Bubble chart' },
  { value: 'heatmap', label: 'Heat map' },
  { value: 'timeline', label: 'Timeline' },
  { value: 'relation-matrix', label: 'Relation matrix' },
  { value: 'relation-columns', label: 'Relation columns' },
  { value: 'nested-map', label: 'Nested map' },
  { value: 'compare-dates', label: 'Compare dates' },
  { value: 'graph', label: 'Graph' },
  { value: 'traceability', label: 'Traceability' },
  { value: 'trail', label: 'Trail' }
];

type EntityBrowserToolbarProps = {
  workspaceId: string;
  q: string;
  setQ: (q: string) => void;
  conditions: FilterCondition[];
  setConditions: (conditions: FilterCondition[]) => void;
  entityQuery?: EntityQuery | null;
  setEntityQuery?: (query: EntityQuery | null) => void;
  schemas: EntitySchema[];
  lifecycleStates: WorkspaceLifecycleState[];
  owners: WorkspaceOwnerOption[];
  enums: WorkspaceEnum[];
  typeFilter: string | null;
  projectId?: string;
  projectScope: 'project' | 'all';
  setProjectScope: (scope: 'project' | 'all') => void;
  sort: string;
  setSort: (sort: string) => void;
  sortOptions: Array<{ value: string; label: string }>;
  view: BrowserView;
  setView: (view: BrowserView) => void;
  readOnly?: boolean;
  tlOpen?: boolean;
  onToggleTimeline?: () => void;
  asOf?: string;
  displayFields?: EntityDisplayField[];
  selectedDisplayFieldIds?: string[];
  onDisplayFieldsChange?: (fieldIds: string[]) => void;
  columnRenderers?: Record<string, ColumnRenderConfig>;
  onColumnRenderersChange?: (columnRenderers: Record<string, ColumnRenderConfig>) => void;
  onDisplayFieldsReset?: () => void;
  joinOptions?: AssessmentJoinOption[];
  joinAssessmentId?: string | null;
  onJoinAssessmentChange?: (assessmentId: string | null) => void;
  joinedAssessment?: Assessment | null;
  assessmentsLoading?: boolean;
  assessmentsReady?: boolean;
  onAssessmentPickerOpenChange?: (open: boolean) => void;
  allowedViews?: Array<{ value: BrowserView; label: string }>;
};

export const EntityBrowserToolbar = ({
  workspaceId,
  q,
  setQ,
  conditions,
  setConditions,
  entityQuery,
  setEntityQuery,
  schemas,
  lifecycleStates,
  owners,
  enums,
  typeFilter,
  projectId,
  projectScope,
  setProjectScope,
  sort,
  setSort,
  sortOptions,
  view,
  setView,
  readOnly,
  tlOpen,
  onToggleTimeline,
  asOf,
  displayFields,
  selectedDisplayFieldIds,
  columnRenderers,
  onColumnRenderersChange,
  onDisplayFieldsChange,
  onDisplayFieldsReset,
  joinOptions,
  joinAssessmentId,
  onJoinAssessmentChange,
  joinedAssessment,
  assessmentsLoading,
  assessmentsReady,
  onAssessmentPickerOpenChange,
  allowedViews
}: EntityBrowserToolbarProps) => {
  return (
    <div className={styles.toolbar}>
      <QueryModeControls
        workspaceId={workspaceId}
        q={q}
        setQ={setQ}
        conditions={conditions}
        setConditions={setConditions}
        entityQuery={entityQuery}
        setEntityQuery={setEntityQuery}
        typeFilter={typeFilter}
        joinAssessmentId={joinAssessmentId}
        schemas={schemas}
        lifecycleStates={lifecycleStates}
        owners={owners}
        enums={enums}
        joinedAssessment={joinedAssessment}
      />
      {joinOptions && onJoinAssessmentChange && !readOnly && (
        <AssessmentJoinPicker
          options={joinOptions}
          value={joinAssessmentId ?? null}
          onChange={onJoinAssessmentChange}
          isLoading={assessmentsLoading ?? false}
          isReady={assessmentsReady ?? false}
          onOpenChange={onAssessmentPickerOpenChange}
        />
      )}
      {projectId && !readOnly && (
        <FilterDropdown
          label="Scope"
          value={projectScope}
          onChange={v => setProjectScope((v as 'project' | 'all') ?? 'project')}
          options={[
            { value: 'project', label: 'Project entities' },
            { value: 'all', label: 'All entities' }
          ]}
        />
      )}
      <div style={{ flex: 1 }} />
      <FilterDropdown label="Sort" value={sort} onChange={setSort} options={sortOptions} />
      {(() => {
        const viewOptions = allowedViews ?? ALL_VIEW_OPTIONS;
        return (
          <>
            <FilterDropdown
              label="View"
              value={view}
              onChange={v => setView(v as BrowserView)}
              options={viewOptions}
            />
            <ViewHelpPopover
              view={view}
              label={viewOptions.find(o => o.value === view)?.label ?? view}
            />
          </>
        );
      })()}
      <ManageFieldsPopover
        fields={displayFields ?? []}
        selectedIds={selectedDisplayFieldIds ?? []}
        onChange={onDisplayFieldsChange ?? (() => {})}
        onReset={onDisplayFieldsReset}
        columnRenderers={columnRenderers}
        onColumnRenderersChange={onColumnRenderersChange}
        disabled={!displayFields || !selectedDisplayFieldIds || !onDisplayFieldsChange}
      />
      {onToggleTimeline && (
        <Button
          size="sm"
          variant={tlOpen || asOf ? 'primary' : 'secondary'}
          icon={<TbHistory size={12} />}
          onClick={onToggleTimeline}
        />
      )}
    </div>
  );
};
