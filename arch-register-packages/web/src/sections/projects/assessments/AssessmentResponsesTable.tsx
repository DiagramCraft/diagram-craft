import { useMemo, useRef, useState, type ReactNode } from 'react';
import { TbFilter } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { Popover, type PopoverActions } from '@diagram-craft/app-components/Popover';
import { Tooltip } from '@diagram-craft/app-components/Tooltip';
import type { Assessment } from '@arch-register/api-types/assessmentContract';
import type { AssessmentEntityStatus } from '@arch-register/api-types/assessmentStatus';
import type { AssessmentResponse } from '@arch-register/api-types/assessmentResponseContract';
import type { EntitySummary } from '@arch-register/api-types/entityContract';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { useUpsertAssessmentResponse } from '../../../hooks/useAssessmentResponses';
import { resolveSchemaColor } from '../../../lib/schemaPresentation';
import { EntityNavigationLink } from '../../../components/EntityNavigationLink';
import { MemberAvatar } from '../../../components/MemberAvatar';
import { SearchInput } from '../../../components/SearchInput';
import { DataTable, type DataTableColumn } from '../../../components/table/DataTable';
import { NameCell } from '../../../components/table/NameCell';
import { useTableSort } from '../../../components/table/useTableSort';
import { TypeBadge } from '../../../components/TypeBadge';
import { AssessmentFieldCell } from './AssessmentFieldCells';
import { AssessmentFilterBuilder } from './AssessmentFilterBuilder';
import { AssessmentResponseHistory } from './AssessmentResponseHistory';
import type { AssessmentFilterCondition } from './assessmentFilterConditions';
import {
  buildAssessmentComparators,
  filterAssessmentEntities,
  type AssessmentOverview,
  type AssessmentStatusFilter
} from './assessmentDetailsViewModel';
import styles from './AssessmentResponsesTable.module.css';

const STATUS_LABEL: Record<AssessmentEntityStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  complete: 'Complete'
};

const CONFIRM_STATUS_LABEL: Record<AssessmentEntityStatus, string> = {
  not_started: 'Not confirmed',
  in_progress: 'Not confirmed',
  complete: 'Confirmed'
};

const STATUS_FILTERS: { key: AssessmentStatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'not_started', label: 'Not started' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'complete', label: 'Complete' }
];

// The in-scope entities of an assessment with their responses: filter, search, sort, edit.
export const AssessmentResponsesTable = ({
  assessment,
  entities,
  overview
}: {
  assessment: Assessment;
  entities: EntitySummary[];
  overview: AssessmentOverview;
}) => {
  const { workspaceSlug, schemas, enums, permissions } = useWorkspaceContext();
  const upsertResponse = useUpsertAssessmentResponse(
    workspaceSlug,
    assessment.id,
    assessment.fields,
    assessment.mode
  );
  const [statusFilter, setStatusFilter] = useState<AssessmentStatusFilter>('all');
  const [search, setSearch] = useState('');
  const [conditions, setConditions] = useState<AssessmentFilterCondition[]>([]);
  const [historyFor, setHistoryFor] = useState<AssessmentResponse | null>(null);
  const filterPopoverRef = useRef<PopoverActions | null>(null);

  const filtered = useMemo(
    () => filterAssessmentEntities({ entities, overview, statusFilter, search, conditions }),
    [entities, overview, statusFilter, search, conditions]
  );
  const comparators = buildAssessmentComparators({
    fields: assessment.fields,
    enums,
    overview,
    schemaNameFor: entity =>
      schemas.find(s => s.id === entity._schema.id)?.name ?? entity._schema.id
  });
  const { sorted, sort, toggleSort } = useTableSort(filtered, comparators);

  const columns = useMemo((): DataTableColumn<EntitySummary>[] => {
    const isOpen = assessment.status === 'open';
    return [
      {
        id: '_name',
        header: 'Entity',
        size: 210,
        minSize: 140,
        meta: { sortable: true, sticky: true, hideable: false, label: 'Entity' },
        cell: ({ row }) => {
          const entity = row.original;
          const schema = schemas.find(s => s.id === entity._schema.id);
          const color = schema ? resolveSchemaColor(schema, schemas.indexOf(schema)) : '#888';
          return (
            <NameCell.Content
              icon={<TypeBadge color={color} name={schema?.name} icon={schema?.icon} size={16} />}
              title={
                <EntityNavigationLink
                  publicId={entity._publicId}
                  className={styles.entNameBtn}
                  title={entity._name}
                >
                  {entity._name ?? entity._slug}
                </EntityNavigationLink>
              }
            />
          );
        }
      },
      {
        id: '_owner',
        header: 'Owner',
        meta: { sortable: true, label: 'Owner' },
        cell: ({ row }) => row.original._owner?.name ?? '—'
      },
      {
        id: '_schema',
        header: 'Schema Type',
        meta: { sortable: true, label: 'Schema Type' },
        cell: ({ row }) =>
          schemas.find(s => s.id === row.original._schema.id)?.name ?? row.original._schema.id
      },
      ...assessment.fields.map(
        (field): DataTableColumn<EntitySummary> => ({
          id: field.id,
          header: field.label,
          size: 180,
          minSize: 100,
          meta: { sortable: true, interactive: true, label: field.label },
          cell: ({ row }) => (
            <AssessmentFieldCell
              field={field}
              value={overview.responseByEntity.get(row.original._uid)?.values?.[field.id]}
              disabled={!isOpen}
              onChange={value =>
                upsertResponse.mutate({
                  entityId: row.original._uid,
                  values: { [field.id]: value }
                })
              }
            />
          )
        })
      ),
      {
        id: '_status',
        header: 'Status',
        size: 160,
        minSize: 150,
        meta: {
          sortable: true,
          interactive: true,
          align: 'right',
          hideable: false,
          label: 'Status'
        },
        cell: ({ row }) => {
          const entity = row.original;
          const status = overview.statusFor(entity._uid);
          return assessment.mode === 'confirm' && status !== 'complete' && isOpen ? (
            <Button onClick={() => upsertResponse.mutate({ entityId: entity._uid, values: {} })}>
              Confirm accurate
            </Button>
          ) : (
            <>
              <span className={`${styles.statusDot} ${styles[`st-${status}`]}`} />
              {assessment.mode === 'confirm' ? CONFIRM_STATUS_LABEL[status] : STATUS_LABEL[status]}
            </>
          );
        }
      },
      {
        id: '_history',
        header: '',
        size: 40,
        enableResizing: false,
        meta: { interactive: true, hideable: false, selectable: false, label: 'History' },
        cell: ({ row }) => {
          const response = overview.responseByEntity.get(row.original._uid);
          if (!response?.updated_by) return null;
          const avatar = (
            <MemberAvatar
              userId={response.updated_by}
              name={response.updated_by_name}
              email={null}
              size={18}
              hideTooltip
            />
          );
          return (
            <Tooltip
              element={
                permissions.canViewAudit ? (
                  <button
                    type="button"
                    className={styles.avatarBtn}
                    onClick={() => setHistoryFor(response)}
                  >
                    {avatar}
                  </button>
                ) : (
                  <span>{avatar}</span>
                )
              }
              message={response.updated_by_name ?? response.updated_by}
            />
          );
        }
      }
    ];
  }, [assessment, overview, schemas, permissions.canViewAudit, upsertResponse]);

  const renderToolbar = (chooser: ReactNode) => (
    <div className={styles.toolbar}>
      <div className={styles.filterGroup}>
        {STATUS_FILTERS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            className={`${styles.filterPill} ${statusFilter === key ? styles.filterPillActive : ''}`}
            onClick={() => setStatusFilter(key)}
          >
            {label} ({overview.counts[key]})
          </button>
        ))}
      </div>
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
        <Popover.Content sideOffset={4} align="start" arrow={false} closeButton={false}>
          <AssessmentFilterBuilder
            conditions={conditions}
            onChange={setConditions}
            onClose={() => filterPopoverRef.current?.close()}
            fields={assessment.fields}
            entities={entities}
            schemas={schemas}
            scope={assessment.scope}
            enums={enums}
          />
        </Popover.Content>
      </Popover.Root>
      <div style={{ flex: 1 }} />
      {chooser}
      <SearchInput
        size="sm"
        className={styles.searchInput}
        value={search}
        onChange={setSearch}
        onClear={() => setSearch('')}
        placeholder="Search entities…"
      />
    </div>
  );

  return (
    <div className={styles.panel}>
      <DataTable
        key={assessment.fields.map(f => f.id).join('|')}
        scroll
        resizable
        columnChooser
        wrapClassName={styles.tableWrap}
        columns={columns}
        data={sorted}
        getRowId={entity => entity._uid}
        sort={sort}
        onSort={toggleSort}
        emptyState="No entities match this filter"
        renderToolbar={renderToolbar}
      />

      {historyFor && (
        <AssessmentResponseHistory
          workspaceSlug={workspaceSlug}
          response={historyFor}
          assessment={assessment}
          onClose={() => setHistoryFor(null)}
        />
      )}
    </div>
  );
};
