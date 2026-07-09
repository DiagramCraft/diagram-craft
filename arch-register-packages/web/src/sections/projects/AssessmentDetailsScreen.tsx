import { useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  TbEdit,
  TbDots,
  TbTrash,
  TbFilter,
  TbDownload,
  TbChevronUp,
  TbChevronDown
} from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import { Popover, type PopoverActions } from '@diagram-craft/app-components/Popover';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import type { ProjectDetail as ProjectDetailData } from '@arch-register/api-types/projectContract';
import type { AssessmentEntityStatus } from '@arch-register/api-types/assessmentStatus';
import { computeAssessmentStatus } from '@arch-register/api-types/assessmentStatus';
import type { Assessment, CreateAssessmentRequest } from '@arch-register/api-types/assessmentContract';
import type { EntitySummary } from '@arch-register/api-types/entityContract';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { resolveSchemaColor } from '../../lib/schemaPresentation';
import { exportAssessmentResponsesToCSV } from '../../lib/assessmentCsv';
import { TypeBadge } from '../../components/TypeBadge';
import { Chip } from '../../components/Chip';
import { DropdownMenu, type MenuItem } from '../../components/DropdownMenu';
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
import sharedStyles from './ProjectDetailScreen.module.css';
import styles from './AssessmentDetailsScreen.module.css';

type StatusFilter = 'all' | AssessmentEntityStatus;
type SortState = { key: string; dir: 'asc' | 'desc' };

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

const SortableHeader = ({
  label,
  sortKey,
  sort,
  onSort,
  className
}: {
  label: ReactNode;
  sortKey: string;
  sort: SortState | null;
  onSort: (key: string) => void;
  className?: string;
}) => {
  const active = sort?.key === sortKey;
  return (
    <th className={className}>
      <button type="button" className={styles.sortHeader} onClick={() => onSort(sortKey)}>
        {label}
        {active && sort ? (
          sort.dir === 'asc' ? (
            <TbChevronUp size={11} />
          ) : (
            <TbChevronDown size={11} />
          )
        ) : null}
      </button>
    </th>
  );
};

export const AssessmentDetailsScreen = ({
  project,
  projectId,
  assessmentId,
  onNavigateHome,
  onNavigateProject,
  onBack
}: {
  project: ProjectDetailData;
  projectId: string;
  assessmentId: string;
  onNavigateHome: () => void;
  onNavigateProject: () => void;
  onBack: () => void;
}) => {
  const navigate = useNavigate();
  const { workspaceSlug, schemas, enums } = useWorkspaceContext();

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
  const [sort, setSort] = useState<SortState | null>(null);
  const [tab, setTab] = useState<'details' | 'summary'>('details');
  const filterPopoverRef = useRef<PopoverActions | null>(null);

  const responseByEntity = useMemo(
    () => new Map(responses.map(r => [r.entity_id, r])),
    [responses]
  );
  const inScopeResponses = useMemo(() => {
    const entityIds = new Set(entities.map(entity => entity._uid));
    return responses.filter(response => entityIds.has(response.entity_id));
  }, [responses, entities]);

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

  const compareBySort = (a: EntitySummary, b: EntitySummary, sortState: SortState): number => {
    const { key } = sortState;
    if (key === '_name') return a._name.localeCompare(b._name);
    if (key === '_owner') return (a._owner?.name ?? '').localeCompare(b._owner?.name ?? '');
    if (key === '_schema') return schemaNameFor(a).localeCompare(schemaNameFor(b));
    if (key === '_status') return STATUS_ORDER[statusFor(a._uid)] - STATUS_ORDER[statusFor(b._uid)];

    const field = assessment?.fields.find(f => f.id === key);
    const aValue = responseByEntity.get(a._uid)?.values[key];
    const bValue = responseByEntity.get(b._uid)?.values[key];
    if (aValue === undefined && bValue === undefined) return 0;
    if (aValue === undefined) return 1;
    if (bValue === undefined) return -1;

    if (field && field.type === 'rating') return (aValue as number) - (bValue as number);
    if (field && field.type === 'enum') {
      const enumDef = enums.find(e => e.id === field.enumId);
      const aLabel = enumDef?.options.find(o => o.value === aValue)?.label ?? String(aValue);
      const bLabel = enumDef?.options.find(o => o.value === bValue)?.label ?? String(bValue);
      return aLabel.localeCompare(bLabel);
    }
    return String(aValue).localeCompare(String(bValue));
  };

  const sorted = sort
    ? [...filtered].sort((a, b) => compareBySort(a, b, sort) * (sort.dir === 'asc' ? 1 : -1))
    : filtered;

  const toggleSort = (key: string) => {
    setSort(prev => {
      if (prev?.key === key) return { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' };
      return { key, dir: 'asc' };
    });
  };

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
        <div className={sharedStyles.empty}>
          <div className={sharedStyles.emptyTitle}>Assessment not found</div>
        </div>
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
          <div className={styles.progress}>
            <span className={styles.progressLabel}>
              {counts.complete} / {entities.length} complete
            </span>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: `${pct}%` }} />
            </div>
          </div>
        }
      >
        <div className={styles.tabs}>
          <Tabs.Root value={tab} onValueChange={v => setTab(v as 'details' | 'summary')}>
          <Tabs.List>
            <Tabs.Trigger value="details">Details</Tabs.Trigger>
            <Tabs.Trigger value="summary">Summary</Tabs.Trigger>
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

              <div className={styles.gridWrap}>
                <table className={styles.grid}>
                  <thead>
                    <tr>
                      <SortableHeader label="Entity" sortKey="_name" sort={sort} onSort={toggleSort} className={styles.entCol} />
                      <SortableHeader label="Owner" sortKey="_owner" sort={sort} onSort={toggleSort} />
                      <SortableHeader label="Schema Type" sortKey="_schema" sort={sort} onSort={toggleSort} />
                      {assessment.fields.map(f => (
                        <SortableHeader
                          key={f.id}
                          sortKey={f.id}
                          sort={sort}
                          onSort={toggleSort}
                          label={
                            <>
                              {f.label}
                              {f.requirementLevel === 'required' && <span className={styles.req}> *</span>}
                            </>
                          }
                        />
                      ))}
                      <SortableHeader label="Status" sortKey="_status" sort={sort} onSort={toggleSort} className={styles.statusCol} />
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.length === 0 ? (
                      <tr>
                        <td className={styles.emptyRow} colSpan={assessment.fields.length + 4}>
                          <div className={`${sharedStyles.empty} ${styles.emptyRowInner}`}>
                            <div className={sharedStyles.emptyTitle}>No entities match this filter</div>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      sorted.map(entity => {
                        const meta = schemas.find(s => s.id === entity._schema.id);
                        const idx = meta ? schemas.indexOf(meta) : -1;
                        const color = meta ? resolveSchemaColor(meta, idx) : '#888';
                        const values = responseByEntity.get(entity._uid)?.values ?? {};
                        const status = statusFor(entity._uid);

                        return (
                          <tr key={entity._uid}>
                            <td className={styles.entCol}>
                              <div className={styles.entName}>
                                <TypeBadge
                                  color={color}
                                  name={meta?.name}
                                  icon={meta?.icon}
                                  size={16}
                                />
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
                              </div>
                            </td>
                            <td className={styles.cell}>{entity._owner?.name ?? '—'}</td>
                            <td className={styles.cell}>{meta?.name ?? entity._schema.id}</td>
                            {assessment.fields.map(field => (
                              <td key={field.id} className={styles.cell}>
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
                              </td>
                            ))}
                            <td className={styles.statusCol}>
                              <span className={`${styles.statusDot} ${styles[`st-${status}`]}`} />
                              {STATUS_LABEL[status]}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
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
    </>
  );
};
