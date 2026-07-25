import { useEffect, useMemo, useState } from 'react';
import { getRouteApi } from '@tanstack/react-router';
import { Button } from '@diagram-craft/app-components/Button';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { Select } from '@diagram-craft/app-components/Select';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import {
  TbPlus,
  TbTrash,
  TbClipboardList,
  TbDatabase,
  TbStar,
  TbListCheck,
  TbAlignLeft,
  TbEdit
} from 'react-icons/tb';
import type { ProjectDetail as ProjectDetailData } from '@arch-register/api-types/projectContract';
import type {
  Assessment,
  AssessmentEnumOption,
  AssessmentField,
  AssessmentRecurrence,
  CreateAssessmentRequest
} from '@arch-register/api-types/assessmentContract';
import type { FilterCondition } from '@arch-register/api-types/viewContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { resolveSchemaColor } from '../../lib/schemaPresentation';
import { TypeBadge } from '../../components/TypeBadge';
import { ProjectScreenLayout } from './ProjectScreenLayout';
import sharedStyles from './ProjectDetailScreen.module.css';
import styles from './ProjectAssessments.module.css';
import {
  useProjectAssessments,
  useCreateAssessment,
  useUpdateAssessmentStatus
} from '../../hooks/useAssessments';
import { useEntitiesBySchema, useEntityCountsBySchema } from '../../hooks/useEntities';
import { AssessmentScopeFilterBuilder } from './components/AssessmentScopeFilterBuilder';
import { EmptyState } from '../../components/EmptyState';
import { assessmentTemplates, cloneAssessmentTemplateValues } from '../../lib/assessmentTemplates';
import { UserGroupPicker } from '../../components/UserGroupPicker';
import { stableHue } from '../../components/MemberAvatar';

const routeApi = getRouteApi('/authenticated/$workspaceSlug/projects/$projectId');

type StatusFilter = 'default' | 'draft' | 'archived' | 'all';
type AssessmentFormData = Omit<CreateAssessmentRequest, 'project_id'>;

const STATUS_LABEL: Record<Assessment['status'], string> = {
  draft: 'Draft',
  open: 'Open',
  closed: 'Closed',
  archived: 'Archived'
};

const FIELD_TYPE_META: Record<
  AssessmentField['type'],
  { icon: typeof TbStar; hint: string | null }
> = {
  rating: { icon: TbStar, hint: '1 – 5' },
  enum: { icon: TbDatabase, hint: null },
  text: { icon: TbAlignLeft, hint: 'free text' }
};

const START_FROM_SCRATCH = '__start_from_scratch__';

export const ProjectAssessments = ({
  project,
  projectId,
  onNavigateHome,
  onNavigateProject
}: {
  project: ProjectDetailData;
  // The raw project route param (may be the public id) — kept distinct from
  // project.id (the resolved internal id) so the query key here matches the
  // one ProjectContentSidebar uses, keeping their caches in sync.
  projectId: string;
  onNavigateHome: () => void;
  onNavigateProject: () => void;
}) => {
  const navigate = routeApi.useNavigate();
  const { workspaceSlug, schemas } = useWorkspaceContext();

  const { data: assessments = [] } = useProjectAssessments(workspaceSlug, projectId);
  const createMutation = useCreateAssessment(workspaceSlug, projectId);
  const statusMutation = useUpdateAssessmentStatus(workspaceSlug, projectId);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('default');
  const [creating, setCreating] = useState(false);

  const schemaColorMap = useMemo(() => {
    const m = new Map<string, { color: string; icon: string | null }>();
    schemas.forEach((s, i) =>
      m.set(s.id, { color: resolveSchemaColor(s, i), icon: s.icon ?? null })
    );
    return m;
  }, [schemas]);

  const counts = {
    default: assessments.filter(a => a.status === 'open' || a.status === 'closed').length,
    draft: assessments.filter(a => a.status === 'draft').length,
    archived: assessments.filter(a => a.status === 'archived').length,
    all: assessments.length
  };

  const filtered = assessments.filter(a => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'default') return a.status === 'open' || a.status === 'closed';
    return a.status === statusFilter;
  });

  const handleSave = async (data: AssessmentFormData, status: Assessment['status']) => {
    const created = await createMutation.mutateAsync(data);
    if (status !== created.status) {
      await statusMutation.mutateAsync({ assessmentId: created.id, status });
    }
    setCreating(false);
  };

  return (
    <>
      <ProjectScreenLayout
        breadcrumbs={[
          {
            label: 'Home',
            onClick: () => navigate({ to: '/$workspaceSlug', params: { workspaceSlug } })
          },
          { label: 'Projects', onClick: onNavigateHome },
          { label: project.name, onClick: onNavigateProject }
        ]}
        title="Assessments"
        actions={
          project.canEdit ? (
            <Button variant="primary" icon={<TbPlus size={12} />} onClick={() => setCreating(true)}>
              New assessment
            </Button>
          ) : undefined
        }
        toolbar={
          <div className={sharedStyles.entityTabNav}>
            {(
              [
                ['default', `Open / Closed (${counts.default})`],
                ['draft', `Draft (${counts.draft})`],
                ['archived', `Archived (${counts.archived})`],
                ['all', `All (${counts.all})`]
              ] as [StatusFilter, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`${sharedStyles.entityTabBtn} ${statusFilter === key ? sharedStyles.entityTabBtnActive : ''}`}
                onClick={() => setStatusFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>
        }
      >
        {filtered.length === 0 ? (
          <div className={styles.list}>
            <EmptyState
              framed
              icon={<TbClipboardList size={20} />}
              title={
                statusFilter === 'default'
                  ? 'No open or closed assessments'
                  : statusFilter === 'draft'
                    ? 'No draft assessments'
                    : statusFilter === 'archived'
                      ? 'No archived assessments'
                      : 'No assessments yet'
              }
              subtitle="Assessments collect structured scores and notes on entities in this project."
              action={
                project.canEdit &&
                statusFilter !== 'archived' && (
                  <Button
                    variant="primary"
                    icon={<TbPlus size={12} />}
                    onClick={() => setCreating(true)}
                  >
                    New assessment
                  </Button>
                )
              }
            />
          </div>
        ) : (
          <div className={styles.list}>
            {filtered.map(assessment => (
              <AssessmentCard
                key={assessment.id}
                assessment={assessment}
                schemaColorMap={schemaColorMap}
                schemas={schemas}
                onOpen={() =>
                  navigate({
                    search: previous => ({
                      ...previous,
                      assessmentId: assessment.id
                    })
                  })
                }
              />
            ))}
          </div>
        )}
      </ProjectScreenLayout>

      {creating && (
        <AssessmentEditorDialog
          assessment={null}
          schemas={schemas}
          isSaving={createMutation.isPending}
          onSave={handleSave}
          onCancel={() => setCreating(false)}
        />
      )}
    </>
  );
};

const AssessmentCard = ({
  assessment,
  schemaColorMap,
  schemas,
  onOpen
}: {
  assessment: Assessment;
  schemaColorMap: Map<string, { color: string; icon: string | null }>;
  schemas: { id: string; name: string }[];
  onOpen: () => void;
}) => {
  const isArchived = assessment.status === 'archived';
  const isDraft = assessment.status === 'draft';
  const showProgress = assessment.status === 'open' || assessment.status === 'closed';
  const badgeClass =
    assessment.status === 'draft'
      ? styles.statusDraft
      : assessment.status === 'open'
        ? styles.statusOpen
        : assessment.status === 'closed'
          ? styles.statusClosed
          : styles.statusArchived;
  const scopeSchemas = assessment.scope
    .map(id => schemas.find(s => s.id === id))
    .filter((s): s is { id: string; name: string } => !!s);

  const { workspaceSlug } = useWorkspaceContext();
  const scopeQueries = useEntitiesBySchema(
    workspaceSlug,
    assessment.scope,
    assessment.scope_conditions
  );
  const inScopeCount = scopeQueries.reduce((sum, q) => sum + (q.data?.length ?? 0), 0);
  const pct =
    inScopeCount > 0 ? Math.round((assessment.completed_entity_count / inScopeCount) * 100) : 0;

  return (
    <button
      type="button"
      className={`${styles.card} ${isArchived ? styles.cardArchived : ''} ${isDraft ? styles.cardDraft : ''}`}
      onClick={onOpen}
    >
      <div className={styles.cardBody}>
        <div className={styles.cardHead}>
          <div className={styles.cardName}>{assessment.name}</div>
          <span className={`${styles.status} ${badgeClass}`}>
            {STATUS_LABEL[assessment.status]}
          </span>
        </div>
        {assessment.description && <div className={styles.cardDesc}>{assessment.description}</div>}
        <div className={styles.cardMeta}>
          <span className={styles.metaItem}>
            <TbListCheck size={11} />
            {assessment.fields.length} field{assessment.fields.length !== 1 ? 's' : ''}
          </span>
          {scopeSchemas.length > 0 && (
            <span className={styles.metaItem}>
              <TbDatabase size={11} />
              <span className={styles.metaScope}>
                {scopeSchemas.map((s, i) => {
                  const meta = schemaColorMap.get(s.id);
                  return (
                    <span key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {i > 0 && <span>·</span>}
                      <TypeBadge color={meta?.color ?? '#888'} icon={meta?.icon} size={13} />
                      {s.name}
                    </span>
                  );
                })}
              </span>
            </span>
          )}
        </div>
        {showProgress && inScopeCount > 0 && (
          <div className={styles.completion}>
            <span className={styles.completionLabel}>
              {assessment.completed_entity_count} / {inScopeCount}
            </span>
            <div className={styles.completionBar}>
              <div className={styles.completionFill} style={{ width: `${pct}%` }} />
            </div>
            <span className={styles.completionPct}>{pct}%</span>
          </div>
        )}
        {assessment.recurrence.type !== 'none' && (
          <div className={styles.metaItem}>
            Cycle {assessment.current_occurrence}
            {assessment.next_occurrence_at &&
              ` · next reopens ${new Date(assessment.next_occurrence_at).toLocaleDateString()}`}
          </div>
        )}
      </div>
    </button>
  );
};

const PickedTeams = ({
  ids,
  labels,
  onRemove
}: {
  ids: string[];
  labels: Map<string, string>;
  onRemove: (id: string) => void;
}) => {
  if (ids.length === 0) return null;
  return (
    <div className={styles.pickedList}>
      {ids.map(id => (
        <span key={id} className={styles.pickedChip}>
          <span
            className={styles.teamDot}
            style={{ background: `oklch(0.65 0.15 ${stableHue(id)})` }}
          />
          {labels.get(id) ?? 'Unavailable team'}
          <button
            type="button"
            className={styles.pickedRemove}
            title="Remove team"
            onClick={() => onRemove(id)}
          >
            ×
          </button>
        </span>
      ))}
    </div>
  );
};

export const AssessmentEditorDialog = ({
  assessment,
  schemas,
  isSaving,
  onSave,
  onCancel
}: {
  assessment: Assessment | null;
  schemas: EntitySchema[];
  isSaving: boolean;
  onSave: (data: AssessmentFormData, status: Assessment['status']) => void;
  onCancel: () => void;
}) => {
  const { workspaceSlug, lifecycleStates, teams } = useWorkspaceContext();
  const isNew = !assessment;
  const [name, setName] = useState(assessment?.name ?? '');
  const [description, setDescription] = useState(assessment?.description ?? '');
  const [scope, setScope] = useState<string[]>(assessment?.scope ?? []);
  const [scopeConditions, setScopeConditions] = useState<FilterCondition[]>(
    assessment?.scope_conditions.map(condition => ({ ...condition })) ?? []
  );
  const [fields, setFields] = useState<AssessmentField[]>(
    assessment?.fields.map(f => ({ ...f })) ?? []
  );
  const [assignedTeamIds, setAssignedTeamIds] = useState<string[]>(
    assessment?.assigned_team_ids ?? []
  );
  const [dueAt, setDueAt] = useState<string>(assessment?.due_at?.slice(0, 10) ?? '');
  const [recurrenceType, setRecurrenceType] = useState<AssessmentRecurrence['type']>(
    assessment?.recurrence.type ?? 'none'
  );
  const [recurrenceInterval, setRecurrenceInterval] = useState<number>(
    assessment?.recurrence.type === 'weekly'
      ? assessment.recurrence.intervalWeeks
      : assessment?.recurrence.type === 'monthly'
        ? assessment.recurrence.intervalMonths
        : 1
  );
  const [responseWindowDays, setResponseWindowDays] = useState<string>(
    assessment?.response_window_days != null ? String(assessment.response_window_days) : ''
  );
  const [status, setStatus] = useState<Assessment['status']>(assessment?.status ?? 'draft');
  const [mode, setMode] = useState<Assessment['mode']>(assessment?.mode ?? 'fields');
  const [selectedTemplateId, setSelectedTemplateId] = useState(isNew ? START_FROM_SCRATCH : '');
  const [isDirty, setIsDirty] = useState(false);
  const [pendingTemplateId, setPendingTemplateId] = useState<string | null>(null);

  const markDirty = () => setIsDirty(true);

  const toggleScope = (id: string) => {
    markDirty();
    setScope(prev => (prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]));
  };

  const allowedScopeConditionFields = useMemo(() => {
    const result = new Set(['_owner', '_lifecycle', '_namespace']);
    for (const schema of schemas.filter(schema => scope.includes(schema.id))) {
      for (const field of schema.fields) {
        if (field.type !== 'reference' && field.type !== 'containment') result.add(field.id);
      }
    }
    return result;
  }, [schemas, scope]);

  useEffect(() => {
    setScopeConditions(prev =>
      prev.filter(condition => allowedScopeConditionFields.has(condition.fieldId))
    );
  }, [allowedScopeConditionFields]);

  const scopeCountQueries = useEntityCountsBySchema(workspaceSlug, scope, scopeConditions);
  const previewCount = scopeCountQueries.reduce((sum, query) => sum + (query.data?.total ?? 0), 0);
  const previewLoading = scopeCountQueries.some(query => query.isLoading || query.isFetching);
  const hasScopeChanged =
    !!assessment &&
    (JSON.stringify([...assessment.scope].sort()) !== JSON.stringify([...scope].sort()) ||
      JSON.stringify(assessment.scope_conditions) !== JSON.stringify(scopeConditions));
  const showScopeWarning = !!assessment && assessment.response_count > 0 && hasScopeChanged;

  const addField = (type: AssessmentField['type']) => {
    markDirty();
    const base = { id: `f${Date.now()}`, label: '', requirementLevel: 'required' as const };
    setFields(prev => [
      ...prev,
      type === 'enum' ? { ...base, type, enumId: '' } : { ...base, type }
    ]);
  };

  const updateField = (id: string, changes: Partial<AssessmentField>) => {
    markDirty();
    setFields(prev =>
      prev.map(f => {
        if (f.id !== id) return f;
        const next = { ...f, ...changes } as Record<string, unknown>;
        if ('enumId' in changes && changes.enumId === undefined) delete next.enumId;
        if ('options' in changes && changes.options === undefined) delete next.options;
        return next as AssessmentField;
      })
    );
  };

  const removeField = (id: string) => {
    markDirty();
    setFields(prev => prev.filter(f => f.id !== id));
  };

  const teamLabels = useMemo(() => new Map(teams.map(team => [team.id, team.name])), [teams]);

  const addTeam = (id: string) => {
    markDirty();
    setAssignedTeamIds(prev => (prev.includes(id) ? prev : [...prev, id]));
  };

  const removeTeam = (id: string) => {
    markDirty();
    setAssignedTeamIds(prev => prev.filter(teamId => teamId !== id));
  };

  const applyTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    setPendingTemplateId(null);

    if (templateId === START_FROM_SCRATCH) {
      setName('');
      setDescription('');
      setScope([]);
      setScopeConditions([]);
      setFields([]);
      setStatus('draft');
      setMode('fields');
      setIsDirty(false);
      return;
    }

    const template = assessmentTemplates.find(item => item.id === templateId);
    if (!template) return;

    const values = cloneAssessmentTemplateValues(template.values);
    setName(values.name);
    setDescription(values.description);
    setScope(values.scope);
    setScopeConditions(values.scope_conditions);
    setFields(values.fields);
    setStatus('draft');
    setMode(values.mode);
    setIsDirty(false);
  };

  const selectTemplate = (value: string | undefined) => {
    const nextTemplateId = value ?? START_FROM_SCRATCH;
    if (nextTemplateId === selectedTemplateId) return;
    if (isDirty) {
      setPendingTemplateId(nextTemplateId);
      return;
    }
    applyTemplate(nextTemplateId);
  };

  const recurrence: AssessmentRecurrence =
    recurrenceType === 'weekly'
      ? { type: 'weekly', intervalWeeks: recurrenceInterval }
      : recurrenceType === 'monthly'
        ? { type: 'monthly', intervalMonths: recurrenceInterval }
        : { type: 'none' };
  const responseWindowDaysNumber =
    responseWindowDays.trim().length > 0 ? Number(responseWindowDays) : null;

  const canSave =
    name.trim().length > 0 &&
    (recurrenceType === 'none' ||
      (responseWindowDaysNumber != null && responseWindowDaysNumber > 0));

  return [
    <Dialog
      key="assessment-editor"
      open
      onClose={onCancel}
      title={isNew ? 'New assessment' : 'Edit assessment'}
      width={600}
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: onCancel },
        {
          label: isSaving ? 'Saving...' : isNew ? 'Create assessment' : 'Save changes',
          type: 'default',
          disabled: !canSave || isSaving,
          onClick: () =>
            onSave(
              {
                name: name.trim(),
                description: description.trim(),
                mode,
                scope,
                scope_conditions: scopeConditions,
                fields: mode === 'confirm' ? [] : fields,
                assigned_team_ids: assignedTeamIds,
                due_at: dueAt.length > 0 ? dueAt : null,
                recurrence,
                response_window_days: responseWindowDaysNumber
              },
              status
            )
        }
      ]}
    >
      <div className={styles.editorTopSection}>
        <div className={styles.editorTopRow}>
          <FormElement label="Name" required>
            <TextInput
              value={name}
              onChange={v => {
                markDirty();
                setName(v ?? '');
              }}
              placeholder="e.g. Security Readiness"
              style={{ width: '100%' }}
            />
          </FormElement>
          {isNew && (
            <FormElement label="Start from template" required={false}>
              <Select.Root value={selectedTemplateId} onChange={selectTemplate}>
                <Select.Item value={START_FROM_SCRATCH}>Start from scratch</Select.Item>
                {assessmentTemplates.map(template => (
                  <Select.Item key={template.id} value={template.id}>
                    {template.label}
                  </Select.Item>
                ))}
              </Select.Root>
            </FormElement>
          )}
        </div>
      </div>

      <Tabs.Root defaultValue="basic-info">
        <Tabs.List aria-label="Assessment editor sections">
          <Tabs.Trigger value="basic-info">Basic Info</Tabs.Trigger>
          <Tabs.Trigger value="scope">Scope</Tabs.Trigger>
          <Tabs.Trigger value="fields">Fields</Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="basic-info" style={{ height: 'auto' }}>
          <div className={styles.section}>
            <div className={styles.sectionLabel}>Description</div>
            <TextInput
              value={description}
              onChange={v => {
                markDirty();
                setDescription(v ?? '');
              }}
              placeholder="Explain the purpose of this assessment"
              style={{ width: '100%' }}
            />
          </div>
          <div className={styles.section}>
            <div className={styles.sectionLabel}>Status</div>
            <div style={{ width: 160 }}>
              <Select.Root
                value={status}
                onChange={v => {
                  markDirty();
                  setStatus((v ?? 'draft') as Assessment['status']);
                }}
              >
                {(Object.keys(STATUS_LABEL) as Assessment['status'][]).map(s => (
                  <Select.Item key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </Select.Item>
                ))}
              </Select.Root>
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionLabel}>Completion mode</div>
            <div className={styles.sectionHint}>
              Either fill in one or more fields per entity, or simply confirm the existing entity
              data is accurate.
            </div>
            <div className={styles.fieldAddButtons}>
              <Button
                variant={mode === 'fields' ? 'primary' : 'secondary'}
                onClick={() => {
                  markDirty();
                  setMode('fields');
                }}
              >
                Fields
              </Button>
              <Button
                variant={mode === 'confirm' ? 'primary' : 'secondary'}
                onClick={() => {
                  markDirty();
                  setMode('confirm');
                }}
              >
                Confirm only
              </Button>
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionLabel}>Assigned teams (optional)</div>
            <div className={styles.sectionHint}>
              {status === 'draft'
                ? 'Assigned teams get a governance inbox task to acknowledge this assessment once it opens.'
                : 'Assigned teams and the due date are locked once an assessment is open. Close and reopen it as draft to change them.'}
            </div>
            <PickedTeams ids={assignedTeamIds} labels={teamLabels} onRemove={removeTeam} />
            {status === 'draft' && (
              <UserGroupPicker
                kind="team"
                excludeIds={assignedTeamIds}
                onSelect={item => addTeam(item.id)}
                placeholder="Search teams to add…"
              />
            )}
          </div>

          <div className={styles.section}>
            <div className={styles.sectionLabel}>Due date (optional)</div>
            <input
              className={styles.dateInput}
              type="date"
              value={dueAt}
              disabled={status !== 'draft'}
              onChange={e => {
                markDirty();
                setDueAt(e.target.value);
              }}
            />
          </div>

          <div className={styles.section}>
            <div className={styles.sectionLabel}>Recurrence</div>
            <div className={styles.sectionHint}>
              Recurring assessments automatically reopen for a new response cycle once the response
              window elapses.
            </div>
            <div style={{ width: 160 }}>
              <Select.Root
                value={recurrenceType}
                onChange={v => {
                  markDirty();
                  setRecurrenceType((v ?? 'none') as AssessmentRecurrence['type']);
                }}
              >
                <Select.Item value="none">One-off (no recurrence)</Select.Item>
                <Select.Item value="weekly">Weekly</Select.Item>
                <Select.Item value="monthly">Monthly</Select.Item>
              </Select.Root>
            </div>
            {recurrenceType !== 'none' && (
              <div className={styles.editorTopRow}>
                <FormElement
                  label={recurrenceType === 'weekly' ? 'Every N weeks' : 'Every N months'}
                >
                  <TextInput
                    value={String(recurrenceInterval)}
                    onChange={v => {
                      markDirty();
                      const parsed = Number(v);
                      setRecurrenceInterval(Number.isFinite(parsed) && parsed > 0 ? parsed : 1);
                    }}
                  />
                </FormElement>
                <FormElement label="Response window (days)" required>
                  <TextInput
                    value={responseWindowDays}
                    onChange={v => {
                      markDirty();
                      setResponseWindowDays(v ?? '');
                    }}
                    placeholder="e.g. 14"
                  />
                </FormElement>
              </div>
            )}
          </div>
        </Tabs.Content>

        <Tabs.Content value="scope" style={{ height: 'auto' }}>
          <div className={styles.section}>
            <div className={styles.sectionHint}>
              Which entity types does this assessment apply to?
            </div>
            <div className={styles.scopeGrid}>
              {schemas.map(schema => {
                const on = scope.includes(schema.id);
                return (
                  <button
                    key={schema.id}
                    type="button"
                    className={`${styles.scopeChip} ${on ? styles.scopeChipOn : ''}`}
                    onClick={() => toggleScope(schema.id)}
                  >
                    <TypeBadge color={schema.color ?? '#888'} icon={schema.icon} size={16} />
                    <span>{schema.name}</span>
                  </button>
                );
              })}
            </div>
            <AssessmentScopeFilterBuilder
              conditions={scopeConditions}
              onChange={conditions => {
                markDirty();
                setScopeConditions(conditions);
              }}
              schemas={schemas}
              scope={scope}
              lifecycleStates={lifecycleStates}
              teams={teams}
            />
            <div className={styles.scopePreview}>
              {scope.length === 0
                ? 'No entity types selected.'
                : previewLoading
                  ? 'Counting matching entities...'
                  : `${previewCount} matching entit${previewCount === 1 ? 'y' : 'ies'}`}
            </div>
            {showScopeWarning && (
              <div className={styles.scopeWarning}>
                Changing scope may add or remove entities from this assessment. Existing responses
                are kept.
              </div>
            )}
          </div>
        </Tabs.Content>

        <Tabs.Content value="fields" style={{ height: 'auto' }}>
          <div className={styles.section}>
            <div className={styles.sectionRow}>
              <div className={styles.sectionLabel}>
                Fields{fields.length > 0 ? ` (${fields.length})` : ''}
              </div>
              <div className={styles.fieldAddButtons}>
                {FIELD_TYPE_OPTIONS.map(([type, label]) => (
                  <Button key={type} icon={<TbPlus size={11} />} onClick={() => addField(type)}>
                    {label}
                  </Button>
                ))}
              </div>
            </div>
            {fields.length === 0 ? (
              <div className={styles.fieldsEmpty}>
                No fields yet — add a Rating, Select, or Notes field above.
              </div>
            ) : (
              <div className={styles.fieldsList}>
                {fields.map(field => (
                  <FieldRow
                    key={field.id}
                    field={field}
                    onUpdate={changes => updateField(field.id, changes)}
                    onRemove={() => removeField(field.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </Tabs.Content>
      </Tabs.Root>
    </Dialog>,
    <Dialog
      key="template-replacement-confirmation"
      open={pendingTemplateId !== null}
      onClose={() => setPendingTemplateId(null)}
      title="Replace assessment template?"
      width={420}
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: () => setPendingTemplateId(null) },
        {
          label: 'Replace values',
          type: 'default',
          onClick: () => {
            if (pendingTemplateId) applyTemplate(pendingTemplateId);
          }
        }
      ]}
    >
      <p>
        Your current assessment values will be replaced by the selected template. This cannot be
        undone.
      </p>
    </Dialog>
  ];
};

const FIELD_TYPE_OPTIONS: [AssessmentField['type'], string][] = [
  ['rating', 'Rating'],
  ['enum', 'Select'],
  ['text', 'Notes']
];

const FieldRow = ({
  field,
  onUpdate,
  onRemove
}: {
  field: AssessmentField;
  onUpdate: (changes: Partial<AssessmentField>) => void;
  onRemove: () => void;
}) => {
  const { enums } = useWorkspaceContext();
  const [inlineOptionsOpen, setInlineOptionsOpen] = useState(false);
  const [draftInlineOptions, setDraftInlineOptions] = useState<AssessmentEnumOption[]>([]);
  const meta = FIELD_TYPE_META[field.type];
  const Icon = meta.icon;
  const placeholders: Record<AssessmentField['type'], string> = {
    rating: 'Rating label…',
    enum: 'Select label…',
    text: 'Notes label…'
  };

  return (
    <div className={styles.fieldRow}>
      <div className={styles.fieldTypeIcon}>
        <Icon size={13} />
      </div>
      <TextInput
        value={field.label}
        onChange={v => onUpdate({ label: v ?? '' })}
        placeholder={placeholders[field.type]}
        style={{ flex: 1, minWidth: 0 }}
      />
      {field.type === 'enum' && (
        <div className={styles.fieldEnum}>
          <div className={styles.enumSourceRow}>
            <Select.Root
              value={'options' in field ? 'inline' : 'workspace'}
              onChange={v => {
                if (v === 'inline') {
                  onUpdate({
                    options:
                      'options' in field && field.options.length > 0
                        ? field.options
                        : [{ value: 'option_1', label: '' }],
                    enumId: undefined
                  } as Partial<AssessmentField>);
                } else {
                  onUpdate({
                    enumId: ('enumId' in field ? field.enumId : undefined) ?? enums[0]?.id ?? '',
                    options: undefined
                  } as Partial<AssessmentField>);
                }
              }}
            >
              <Select.Item value="workspace">Existing enum</Select.Item>
              <Select.Item value="inline">Inline values</Select.Item>
            </Select.Root>
            {'options' in field && (
              <Button
                variant="ghost"
                icon={<TbEdit size={13} />}
                onClick={() => {
                  setDraftInlineOptions(field.options.map(option => ({ ...option })));
                  setInlineOptionsOpen(true);
                }}
                title="Edit inline values"
              />
            )}
          </div>
          {'options' in field ? null : (
            <Select.Root
              value={field.enumId}
              placeholder="Choose enum…"
              onChange={v => onUpdate({ enumId: v ?? '' } as Partial<AssessmentField>)}
            >
              {enums.map(en => (
                <Select.Item key={en.id} value={en.id}>
                  {en.name}
                </Select.Item>
              ))}
            </Select.Root>
          )}
        </div>
      )}
      {meta.hint && <span className={styles.fieldHint}>{meta.hint}</span>}
      <div className={styles.fieldRequirement}>
        <Select.Root
          value={field.requirementLevel}
          onChange={v =>
            onUpdate({ requirementLevel: (v ?? 'required') as 'required' | 'optional' })
          }
        >
          <Select.Item value="required">Required</Select.Item>
          <Select.Item value="optional">Optional</Select.Item>
        </Select.Root>
      </div>
      <Button
        variant="ghost"
        icon={<TbTrash size={13} />}
        onClick={onRemove}
        title="Remove field"
      />
      {field.type === 'enum' && 'options' in field && (
        <Dialog
          open={inlineOptionsOpen}
          onClose={() => setInlineOptionsOpen(false)}
          title={`Edit values: ${field.label || 'Select field'}`}
          width={520}
          buttons={[
            { label: 'Cancel', type: 'cancel', onClick: () => setInlineOptionsOpen(false) },
            {
              label: 'Save values',
              type: 'default',
              onClick: () => {
                onUpdate({ options: draftInlineOptions } as Partial<AssessmentField>);
                setInlineOptionsOpen(false);
              }
            }
          ]}
        >
          <div className={styles.inlineEnumDialogOptions}>
            {draftInlineOptions.map((option, index) => (
              <div key={`${option.value}-${index}`} className={styles.inlineEnumDialogOption}>
                <TextInput
                  value={option.value}
                  onChange={value =>
                    setDraftInlineOptions(current =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, value: value ?? '' } : item
                      )
                    )
                  }
                  placeholder="Value"
                />
                <TextInput
                  value={option.label}
                  onChange={value =>
                    setDraftInlineOptions(current =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, label: value ?? '' } : item
                      )
                    )
                  }
                  placeholder="Label"
                />
                <Button
                  variant="ghost"
                  icon={<TbTrash size={13} />}
                  onClick={() =>
                    setDraftInlineOptions(current =>
                      current.filter((_, itemIndex) => itemIndex !== index)
                    )
                  }
                  title="Remove option"
                />
              </div>
            ))}
            <Button
              variant="ghost"
              icon={<TbPlus size={13} />}
              onClick={() =>
                setDraftInlineOptions(current => [
                  ...current,
                  { value: `option_${current.length + 1}`, label: '' }
                ])
              }
            >
              Add option
            </Button>
          </div>
        </Dialog>
      )}
    </div>
  );
};
