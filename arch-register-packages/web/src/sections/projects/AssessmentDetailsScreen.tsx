import { useMemo, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { TbEdit, TbDots, TbTrash, TbFilter, TbDownload } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import { Popover, type PopoverActions } from '@diagram-craft/app-components/Popover';
import { Tooltip } from '@diagram-craft/app-components/Tooltip';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import type { ProjectDetail as ProjectDetailData } from '@arch-register/api-types/projectContract';
import type { AssessmentEntityStatus } from '@arch-register/api-types/assessmentStatus';
import { computeAssessmentStatus } from '@arch-register/api-types/assessmentStatus';
import type {
  Assessment,
  CreateAssessmentRequest
} from '@arch-register/api-types/assessmentContract';
import type { EntitySummary } from '@arch-register/api-types/entityContract';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { resolveSchemaColor } from '../../lib/schemaPresentation';
import { exportAssessmentResponsesToCSV } from '../../lib/assessmentCsv';
import { TypeBadge } from '../../components/TypeBadge';
import { Chip } from '../../components/Chip';
import { DropdownMenu, type MenuItem } from '../../components/DropdownMenu';
import { MemberAvatar } from '../../components/MemberAvatar';
import { AssessmentResponseHistory } from './components/AssessmentResponseHistory';
import { DiscussionThread } from '../discussions/DiscussionThread';
import {
  useAssessments,
  useUpdateAssessment,
  useUpdateAssessmentStatus,
  useDeleteAssessment
} from '../../hooks/useAssessments';
import { useEntitiesBySchema } from '../../hooks/useEntities';
import {
  useAssessmentResponses,
  useUpsertAssessmentResponse
} from '../../hooks/useAssessmentResponses';
import type { AssessmentResponse } from '@arch-register/api-types/assessmentResponseContract';
import { entityDetailRoute, asEntityPublicId } from '../../routes/publicObjectRoutes';
import { ProjectScreenLayout } from './ProjectScreenLayout';
import { AssessmentEditorDialog } from './ProjectAssessments';
import { AssessmentFieldCell } from './components/AssessmentFieldCells';
import {
  AssessmentFilterBuilder,
  matchesAssessmentFilterConditions,
  type AssessmentFilterCondition
} from './components/AssessmentFilterBuilder';
import { AssessmentSummaryTab } from './components/AssessmentSummaryTab';
import { Table } from '../../components/table/Table';
import { useTableSort } from '../../components/table/useTableSort';
import { EmptyState } from '../../components/EmptyState';
import sharedStyles from './ProjectDetailScreen.module.css';
import styles from './AssessmentDetailsScreen.module.css';

type StatusFilter = 'all' | AssessmentEntityStatus;

const STATUS_LABEL: Record<AssessmentEntityStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  complete: 'Complete'
};

const ASSESSMENT_STATUS_LABEL: Record<Assessment['status'], string> = {
  draft: 'Draft',
  open: 'Open',
  closed: 'Closed',
  archived: 'Archived'
};

const ASSESSMENT_STATUS_COLOR: Record<Assessment['status'], string> = {
  draft: 'var(--cmp-fg-dim)',
  open: 'var(--green)',
  closed: 'var(--warn, orange)',
  archived: 'var(--cmp-fg-disabled)'
};

const STATUS_ORDER: Record<AssessmentEntityStatus, number> = {
  not_started: 0,
  in_progress: 1,
  complete: 2
};

export const AssessmentDetailsScreen = ({
  project,
  projectId,
  assessmentId,
  initialTab,
  onNavigateHome,
  onNavigateProject,
  onBack
}: {
  project: ProjectDetailData;
  projectId: string;
  assessmentId: string;
  initialTab?: 'details' | 'summary' | 'discussion';
  onNavigateHome: () => void;
  onNavigateProject: () => void;
  onBack: () => void;
}) => {
  const navigate = useNavigate();
  const { workspaceSlug, schemas, enums, permissions } = useWorkspaceContext();

  const { data: assessments = [] } = useAssessments(workspaceSlug, projectId);
  const assessment = assessments.find(a => a.id === assessmentId);
  const updateMutation = useUpdateAssessment(workspaceSlug, projectId);
  const statusMutation = useUpdateAssessmentStatus(workspaceSlug, projectId);
  const deleteMutation = useDeleteAssessment(workspaceSlug, projectId);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const scopeQueries = useEntitiesBySchema(
    workspaceSlug,
    assessment?.scope ?? [],
    assessment?.scope_conditions ?? []
  );
  const entities = useMemo(
    () => scopeQueries.flatMap(q => q.data ?? []) as EntitySummary[],
    [scopeQueries]
  );

  const { data: responses = [] } = useAssessmentResponses(workspaceSlug, projectId, assessmentId);
  const upsertResponse = useUpsertAssessmentResponse(
    workspaceSlug,
    projectId,
    assessmentId,
    assessment?.fields ?? []
  );

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [conditions, setConditions] = useState<AssessmentFilterCondition[]>([]);
  const [tab, setTab] = useState<'details' | 'summary' | 'discussion'>(initialTab ?? 'details');
  const filterPopoverRef = useRef<PopoverActions | null>(null);

  const responseByEntity = useMemo(
    () => new Map(responses.map(r => [r.entity_id, r])),
    [responses]
  );
  const inScopeResponses = useMemo(() => {
    const entityIds = new Set(entities.map(entity => entity._uid));
    return responses.filter(response => entityIds.has(response.entity_id));
  }, [responses, entities]);

  const assessors = useMemo(() => {
    const byId = new Map<string, string | null>();
    for (const response of inScopeResponses) {
      if (response.updated_by) byId.set(response.updated_by, response.updated_by_name);
    }
    return [...byId.entries()].map(([userId, name]) => ({ userId, name }));
  }, [inScopeResponses]);

  const [historyFor, setHistoryFor] = useState<AssessmentResponse | null>(null);

  const statusFor = (entityId: string): AssessmentEntityStatus =>
    responseByEntity.get(entityId)?.status ??
    computeAssessmentStatus(assessment?.fields ?? [], undefined);

  const counts = useMemo(() => {
    const result: Record<StatusFilter, number> = {
      all: entities.length,
      not_started: 0,
      in_progress: 0,
      complete: 0
    };
    entities.forEach(e => {
      const status =
        responseByEntity.get(e._uid)?.status ??
        computeAssessmentStatus(assessment?.fields ?? [], undefined);
      result[status]++;
    });
    return result;
  }, [entities, responseByEntity, assessment]);

  const filtered = entities.filter(e => {
    if (statusFilter !== 'all' && statusFor(e._uid) !== statusFilter) return false;
    if (search && !e._name.toLowerCase().includes(search.toLowerCase())) return false;
    if (
      conditions.length > 0 &&
      !matchesAssessmentFilterConditions(e, responseByEntity.get(e._uid)?.values ?? {}, conditions)
    )
      return false;
    return true;
  });

  const schemaNameFor = (entity: EntitySummary): string =>
    schemas.find(s => s.id === entity._schema.id)?.name ?? entity._schema.id;

  const fieldComparator =
    (field: Assessment['fields'][number]) =>
    (a: EntitySummary, b: EntitySummary): number => {
      const aValue = responseByEntity.get(a._uid)?.values[field.id];
      const bValue = responseByEntity.get(b._uid)?.values[field.id];
      if (aValue === undefined && bValue === undefined) return 0;
      if (aValue === undefined) return 1;
      if (bValue === undefined) return -1;

      if (field.type === 'rating') return (aValue as number) - (bValue as number);
      if (field.type === 'enum') {
        const enumDef = enums.find(e => e.id === field.enumId);
        const aLabel = enumDef?.options.find(o => o.value === aValue)?.label ?? String(aValue);
        const bLabel = enumDef?.options.find(o => o.value === bValue)?.label ?? String(bValue);
        return aLabel.localeCompare(bLabel);
      }
      return String(aValue).localeCompare(String(bValue));
    };

  const comparators: Record<string, (a: EntitySummary, b: EntitySummary) => number> = {
    _name: (a, b) => a._name.localeCompare(b._name),
    _owner: (a, b) => (a._owner?.name ?? '').localeCompare(b._owner?.name ?? ''),
    _schema: (a, b) => schemaNameFor(a).localeCompare(schemaNameFor(b)),
    _status: (a, b) => STATUS_ORDER[statusFor(a._uid)] - STATUS_ORDER[statusFor(b._uid)]
  };
  for (const field of assessment?.fields ?? []) {
    comparators[field.id] = fieldComparator(field);
  }

  const { sorted, sort, toggleSort } = useTableSort(filtered, comparators);

  const handleExport = async () => {
    try {
      const blob = await exportAssessmentResponsesToCSV(workspaceSlug, projectId, assessmentId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${assessment?.name ?? 'assessment'}-results-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export assessment results. Please try again.');
    }
  };

  const baseBreadcrumbs = [
    {
      label: 'Home',
      onClick: () => navigate({ to: '/$workspaceSlug', params: { workspaceSlug } })
    },
    { label: 'Projects', onClick: onNavigateHome },
    { label: project.name, onClick: onNavigateProject },
    { label: 'Assessments', onClick: onBack }
  ];

  if (!assessment) {
    return (
      <ProjectScreenLayout breadcrumbs={baseBreadcrumbs} title="Assessment">
        <EmptyState framed title="Assessment not found" />
      </ProjectScreenLayout>
    );
  }

  const pct = entities.length > 0 ? Math.round((counts.complete / entities.length) * 100) : 0;

  const FILTERS: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'not_started', label: 'Not started' },
    { key: 'in_progress', label: 'In progress' },
    { key: 'complete', label: 'Complete' }
  ];

  const breadcrumbs = [...baseBreadcrumbs, { label: assessment.name }];

  const handleSave = async (data: CreateAssessmentRequest, status: Assessment['status']) => {
    await updateMutation.mutateAsync({ assessmentId: assessment.id, data });
    if (status !== assessment.status) {
      await statusMutation.mutateAsync({ assessmentId: assessment.id, status });
    }
    setEditing(false);
  };

  const menuItems: MenuItem[] = [
    {
      label: 'Export CSV',
      icon: <TbDownload size={14} />,
      onClick: handleExport
    },
    ...(project.canEdit
      ? [
          {
            label: 'Delete',
            icon: <TbTrash size={14} />,
            danger: true,
            onClick: () => setDeleting(true)
          }
        ]
      : [])
  ];

  return (
    <>
      <ProjectScreenLayout
        breadcrumbs={breadcrumbs}
        title={assessment.name}
        chips={
          <Chip dot={ASSESSMENT_STATUS_COLOR[assessment.status]} tone="ghost">
            {ASSESSMENT_STATUS_LABEL[assessment.status]}
          </Chip>
        }
        description={assessment.description}
        actions={
          project.canEdit ? (
            <Button icon={<TbEdit size={12} />} onClick={() => setEditing(true)}>
              Edit
            </Button>
          ) : undefined
        }
        menu={
          menuItems.length > 0 ? (
            <DropdownMenu
              trigger={
                <button type="button" className={sharedStyles.iconBtn}>
                  <TbDots size={14} />
                </button>
              }
              items={menuItems}
            />
          ) : undefined
        }
        meta={
          <div className={styles.metaGroup}>
            {assessors.length > 0 && (
              <div className={styles.assessors}>
                {assessors.map(a => (
                  <MemberAvatar
                    key={a.userId}
                    userId={a.userId}
                    name={a.name}
                    email={null}
                    size={20}
                  />
                ))}
              </div>
            )}
            <div className={styles.progress}>
              <span className={styles.progressLabel}>
                {counts.complete} / {entities.length} complete
              </span>
              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: `${pct}%` }} />
              </div>
            </div>
          </div>
        }
      >
        <div className={styles.tabs}>
          <Tabs.Root
            value={tab}
            onValueChange={v => setTab(v as 'details' | 'summary' | 'discussion')}
          >
            <Tabs.List>
              <Tabs.Trigger value="details">Details</Tabs.Trigger>
              <Tabs.Trigger value="summary">Summary</Tabs.Trigger>
              <Tabs.Trigger value="discussion">Discussion</Tabs.Trigger>
            </Tabs.List>
            <Tabs.Content value="details">
              <div className={styles.panel}>
                <div className={styles.toolbar}>
                  <div className={styles.filterGroup}>
                    {FILTERS.map(({ key, label }) => (
                      <button
                        key={key}
                        type="button"
                        className={`${styles.filterPill} ${statusFilter === key ? styles.filterPillActive : ''}`}
                        onClick={() => setStatusFilter(key)}
                      >
                        {label} ({counts[key]})
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
                  <TextInput
                    value={search}
                    onChange={v => setSearch(v ?? '')}
                    placeholder="Search entities…"
                    style={{ width: 220 }}
                  />
                </div>

                <Table.Root scroll stickyHeader>
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
                        <Table.SortableHeaderCell
                          key={f.id}
                          sortKey={f.id}
                          sort={sort}
                          onSort={toggleSort}
                        >
                          {f.label}
                          {f.requirementLevel === 'required' && (
                            <span className={styles.req}> *</span>
                          )}
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
                      sorted.map(entity => {
                        const meta = schemas.find(s => s.id === entity._schema.id);
                        const idx = meta ? schemas.indexOf(meta) : -1;
                        const color = meta ? resolveSchemaColor(meta, idx) : '#888';
                        const response = responseByEntity.get(entity._uid);
                        const values = response?.values ?? {};
                        const status = statusFor(entity._uid);

                        return (
                          <Table.Row key={entity._uid}>
                            <Table.NameCell
                              sticky
                              className={styles.entCol}
                              width={210}
                              icon={
                                <TypeBadge
                                  color={color}
                                  name={meta?.name}
                                  icon={meta?.icon}
                                  size={16}
                                />
                              }
                              title={
                                <button
                                  type="button"
                                  className={styles.entNameBtn}
                                  title={entity._name}
                                  onClick={() =>
                                    navigate(
                                      entityDetailRoute(
                                        workspaceSlug,
                                        asEntityPublicId(entity._publicId)
                                      )
                                    )
                                  }
                                >
                                  {entity._name || entity._slug}
                                </button>
                              }
                            />
                            <Table.Cell className={styles.cell}>
                              {entity._owner?.name ?? '—'}
                            </Table.Cell>
                            <Table.Cell className={styles.cell}>
                              {meta?.name ?? entity._schema.id}
                            </Table.Cell>
                            {assessment.fields.map(field => (
                              <Table.Cell key={field.id} className={styles.cell}>
                                <AssessmentFieldCell
                                  field={field}
                                  value={values[field.id]}
                                  disabled={assessment.status !== 'open'}
                                  onChange={value =>
                                    upsertResponse.mutate({
                                      entityId: entity._uid,
                                      values: { [field.id]: value }
                                    })
                                  }
                                />
                              </Table.Cell>
                            ))}
                            <Table.Cell align="right" className={styles.statusCol}>
                              <span className={`${styles.statusDot} ${styles[`st-${status}`]}`} />
                              {STATUS_LABEL[status]}
                            </Table.Cell>
                            <Table.Cell className={styles.avatarCol}>
                              {response?.updated_by && (
                                <Tooltip
                                  element={
                                    permissions.canViewAudit ? (
                                      <button
                                        type="button"
                                        className={styles.avatarBtn}
                                        onClick={() => setHistoryFor(response)}
                                      >
                                        <MemberAvatar
                                          userId={response.updated_by}
                                          name={response.updated_by_name}
                                          email={null}
                                          size={18}
                                          hideTooltip
                                        />
                                      </button>
                                    ) : (
                                      <span>
                                        <MemberAvatar
                                          userId={response.updated_by}
                                          name={response.updated_by_name}
                                          email={null}
                                          size={18}
                                          hideTooltip
                                        />
                                      </span>
                                    )
                                  }
                                  message={response.updated_by_name ?? response.updated_by}
                                />
                              )}
                            </Table.Cell>
                          </Table.Row>
                        );
                      })
                    )}
                  </Table.Body>
                </Table.Root>
              </div>
            </Tabs.Content>
            <Tabs.Content value="summary">
              <AssessmentSummaryTab
                assessment={assessment}
                responses={inScopeResponses}
                entityCount={entities.length}
                enums={enums}
              />
            </Tabs.Content>
            <Tabs.Content value="discussion">
              <div className={styles.discussionPanel}>
                <DiscussionThread
                  workspaceId={workspaceSlug}
                  objectType="assessment"
                  objectId={assessment.id}
                />
              </div>
            </Tabs.Content>
          </Tabs.Root>
        </div>
      </ProjectScreenLayout>

      {editing && (
        <AssessmentEditorDialog
          assessment={assessment}
          schemas={schemas}
          isSaving={updateMutation.isPending}
          onSave={handleSave}
          onCancel={() => setEditing(false)}
        />
      )}

      <DeleteConfirmationDialog
        open={deleting}
        title="Delete assessment?"
        message={
          <>
            <b>{assessment.name}</b> will be permanently deleted
            {assessment.response_count > 0
              ? `, along with ${assessment.response_count} recorded response${assessment.response_count !== 1 ? 's' : ''}.`
              : '.'}
          </>
        }
        detail="This can't be undone."
        confirmLabel="Delete assessment"
        onConfirm={() => {
          deleteMutation.mutate(assessment.id);
          setDeleting(false);
          onBack();
        }}
        onCancel={() => setDeleting(false)}
      />

      {historyFor && (
        <AssessmentResponseHistory
          workspaceSlug={workspaceSlug}
          response={historyFor}
          assessment={assessment}
          onClose={() => setHistoryFor(null)}
        />
      )}
    </>
  );
};
