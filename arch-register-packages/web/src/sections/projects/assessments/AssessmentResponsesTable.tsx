import { useMemo, useRef, useState } from 'react';
import { TbFilter } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { Popover, type PopoverActions } from '@diagram-craft/app-components/Popover';
import { Tooltip } from '@diagram-craft/app-components/Tooltip';
import type { Assessment } from '@arch-register/api-types/assessmentContract';
import type { AssessmentEntityStatus } from '@arch-register/api-types/assessmentStatus';
import type { AssessmentResponse } from '@arch-register/api-types/assessmentResponseContract';
import type { EntitySummary } from '@arch-register/api-types/entityContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { useUpsertAssessmentResponse } from '../../../hooks/useAssessmentResponses';
import { resolveSchemaColor } from '../../../lib/schemaPresentation';
import { EmptyState } from '../../../components/EmptyState';
import { EntityNavigationLink } from '../../../components/EntityNavigationLink';
import { MemberAvatar } from '../../../components/MemberAvatar';
import { SearchInput } from '../../../components/SearchInput';
import { Table } from '../../../components/table/Table';
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

  return (
    <div className={styles.panel}>
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
        <SearchInput
          size="sm"
          className={styles.searchInput}
          value={search}
          onChange={setSearch}
          onClear={() => setSearch('')}
          placeholder="Search entities…"
        />
      </div>

      <Table.Root scroll scrollY stickyHeader wrapClassName={styles.tableWrap}>
        <Table.Head>
          <Table.Row>
            <Table.SortableHeaderCell
              sortKey="_name"
              sort={sort}
              onSort={toggleSort}
              sticky
              width={210}
            >
              Entity
            </Table.SortableHeaderCell>
            <Table.SortableHeaderCell sortKey="_owner" sort={sort} onSort={toggleSort}>
              Owner
            </Table.SortableHeaderCell>
            <Table.SortableHeaderCell sortKey="_schema" sort={sort} onSort={toggleSort}>
              Schema Type
            </Table.SortableHeaderCell>
            {assessment.fields.map(f => (
              <Table.SortableHeaderCell key={f.id} sortKey={f.id} sort={sort} onSort={toggleSort}>
                {f.label}
              </Table.SortableHeaderCell>
            ))}
            <Table.SortableHeaderCell
              sortKey="_status"
              sort={sort}
              onSort={toggleSort}
              align="right"
              className={styles.statusCol}
            >
              Status
            </Table.SortableHeaderCell>
            <Table.HeaderCell className={styles.avatarCol} />
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {sorted.length === 0 ? (
            <Table.EmptyRow colSpan={assessment.fields.length + 5}>
              <EmptyState title="No entities match this filter" />
            </Table.EmptyRow>
          ) : (
            sorted.map(entity => (
              <AssessmentResponseRow
                key={entity._uid}
                assessment={assessment}
                entity={entity}
                schemas={schemas}
                response={overview.responseByEntity.get(entity._uid)}
                status={overview.statusFor(entity._uid)}
                canViewHistory={permissions.canViewAudit}
                onChange={(fieldId, value) =>
                  upsertResponse.mutate({ entityId: entity._uid, values: { [fieldId]: value } })
                }
                onConfirm={() => upsertResponse.mutate({ entityId: entity._uid, values: {} })}
                onShowHistory={setHistoryFor}
              />
            ))
          )}
        </Table.Body>
      </Table.Root>

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

const AssessmentResponseRow = ({
  assessment,
  entity,
  schemas,
  response,
  status,
  canViewHistory,
  onChange,
  onConfirm,
  onShowHistory
}: {
  assessment: Assessment;
  entity: EntitySummary;
  schemas: EntitySchema[];
  response: AssessmentResponse | undefined;
  status: AssessmentEntityStatus;
  canViewHistory: boolean;
  onChange: (fieldId: string, value: string | number | boolean | null) => void;
  onConfirm: () => void;
  onShowHistory: (response: AssessmentResponse) => void;
}) => {
  const schema = schemas.find(s => s.id === entity._schema.id);
  const color = schema ? resolveSchemaColor(schema, schemas.indexOf(schema)) : '#888';
  const values = response?.values ?? {};

  const avatar = response?.updated_by ? (
    <MemberAvatar
      userId={response.updated_by}
      name={response.updated_by_name}
      email={null}
      size={18}
      hideTooltip
    />
  ) : null;

  return (
    <Table.Row>
      <Table.NameCell
        sticky
        className={styles.entCol}
        width={210}
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
      <Table.Cell className={styles.cell}>{entity._owner?.name ?? '—'}</Table.Cell>
      <Table.Cell className={styles.cell}>{schema?.name ?? entity._schema.id}</Table.Cell>
      {assessment.fields.map(field => (
        <Table.Cell key={field.id} className={styles.cell}>
          <AssessmentFieldCell
            field={field}
            value={values[field.id]}
            disabled={assessment.status !== 'open'}
            onChange={value => onChange(field.id, value)}
          />
        </Table.Cell>
      ))}
      <Table.Cell align="right" className={styles.statusCol}>
        {assessment.mode === 'confirm' && status !== 'complete' && assessment.status === 'open' ? (
          <Button onClick={onConfirm}>Confirm accurate</Button>
        ) : (
          <>
            <span className={`${styles.statusDot} ${styles[`st-${status}`]}`} />
            {assessment.mode === 'confirm' ? CONFIRM_STATUS_LABEL[status] : STATUS_LABEL[status]}
          </>
        )}
      </Table.Cell>
      <Table.Cell className={styles.avatarCol}>
        {response?.updated_by && (
          <Tooltip
            element={
              canViewHistory ? (
                <button
                  type="button"
                  className={styles.avatarBtn}
                  onClick={() => onShowHistory(response)}
                >
                  {avatar}
                </button>
              ) : (
                <span>{avatar}</span>
              )
            }
            message={response.updated_by_name ?? response.updated_by}
          />
        )}
      </Table.Cell>
    </Table.Row>
  );
};
