import { useRef } from 'react';
import { TbFilter, TbHistory } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { Popover, type PopoverActions } from '@diagram-craft/app-components/Popover';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type {
  WorkspaceLifecycleState,
  WorkspaceOwnerOption
} from '@arch-register/api-types/workspaceContract';
import type { WorkspaceEnum } from '@arch-register/api-types/enumContract';
import type { BrowserView, FilterCondition } from '@arch-register/api-types/viewContract';
import type { Assessment } from '@arch-register/api-types/assessmentContract';
import { FilterBuilder } from '../../../components/FilterBuilder';
import { FilterDropdown } from '../../../components/FilterDropdown';
import { SearchInput } from '../../../components/SearchInput';
import styles from './EntityBrowser.module.css';
import { ManageFieldsPopover } from './ManageFieldsPopover';
import { AssessmentJoinPicker } from './AssessmentJoinPicker';
import type { EntityDisplayField } from './entityDisplayFields';
import type { AssessmentJoinOption } from './useJoinedAssessment';

type EntityBrowserToolbarProps = {
  q: string;
  setQ: (q: string) => void;
  conditions: FilterCondition[];
  setConditions: (conditions: FilterCondition[]) => void;
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
  onDisplayFieldsReset?: () => void;
  joinOptions?: AssessmentJoinOption[];
  joinAssessmentId?: string | null;
  onJoinAssessmentChange?: (assessmentId: string | null) => void;
  joinedAssessment?: Assessment | null;
  allowedViews?: Array<{ value: BrowserView; label: string }>;
};

export const EntityBrowserToolbar = ({
  q,
  setQ,
  conditions,
  setConditions,
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
  onDisplayFieldsChange,
  onDisplayFieldsReset,
  joinOptions,
  joinAssessmentId,
  onJoinAssessmentChange,
  joinedAssessment,
  allowedViews
}: EntityBrowserToolbarProps) => {
  const filterPopoverRef = useRef<PopoverActions | null>(null);

  return (
    <div className={styles.toolbar}>
      <SearchInput
        size="sm"
        className={styles.searchInline}
        placeholder="Search by name, owner…"
        value={q}
        onChange={setQ}
        onClear={() => setQ('')}
      />
      <Popover.Root actionsRef={filterPopoverRef}>
        <Popover.Trigger
          element={
            <Button size="sm" variant={conditions.length > 0 ? 'primary' : 'secondary'}>
              <TbFilter size={12} style={{ marginRight: 4 }} />
              Filter
              {conditions.length > 0 && (
                <span className={styles.filterCount}>{conditions.length}</span>
              )}
            </Button>
          }
        />
        <Popover.Content
          sideOffset={4}
          align="start"
          arrow={false}
          closeButton={false}
          className={styles.filterPopover}
        >
          <FilterBuilder
            conditions={conditions}
            onChange={setConditions}
            onClose={() => filterPopoverRef.current?.close()}
            schemas={schemas}
            lifecycleStates={lifecycleStates}
            owners={owners}
            enums={enums}
            selectedSchemaId={typeFilter}
            joinedAssessment={joinedAssessment}
          />
        </Popover.Content>
      </Popover.Root>
      {joinOptions && onJoinAssessmentChange && !readOnly && (
        <AssessmentJoinPicker
          options={joinOptions}
          value={joinAssessmentId ?? null}
          onChange={onJoinAssessmentChange}
        />
      )}
      {projectId && !readOnly && (
        <FilterDropdown
          label="Scope"
          value={projectScope}
          onChange={v => setProjectScope((v as 'project' | 'all') ?? 'project')}
          options={[
            { value: 'project', label: 'Project entities only' },
            { value: 'all', label: 'All entities' }
          ]}
        />
      )}
      <div style={{ flex: 1 }} />
      <FilterDropdown label="Sort" value={sort} onChange={setSort} options={sortOptions} />
      <FilterDropdown
        label="View"
        value={view}
        onChange={v => setView(v as BrowserView)}
        options={
          allowedViews ?? [
            { value: 'table', label: 'Table' },
            { value: 'cards', label: 'Cards' },
            { value: 'tree', label: 'Tree' },
            { value: 'radar', label: 'Radar' },
            { value: 'bubble', label: 'Bubble' },
            { value: 'timeline', label: 'Timeline' },
            { value: 'matrix', label: 'Matrix' },
            { value: 'hierarchy', label: 'Hierarchy' },
            { value: 'explore', label: 'Explore' }
          ]
        }
      />
      <ManageFieldsPopover
        fields={displayFields ?? []}
        selectedIds={selectedDisplayFieldIds ?? []}
        onChange={onDisplayFieldsChange ?? (() => {})}
        onReset={onDisplayFieldsReset}
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
