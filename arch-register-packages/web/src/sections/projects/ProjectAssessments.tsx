import { useEffect, useMemo, useRef, useState } from 'react';
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
  TbEdit,
  TbDots
} from 'react-icons/tb';
import { MenuButton } from '@diagram-craft/app-components/MenuButton';
import { Menu } from '@diagram-craft/app-components/Menu';
import { usePortal } from '@diagram-craft/app-components/PortalContext';
import type { ProjectDetail as ProjectDetailData } from '@arch-register/api-types/projectContract';
import type {
  Assessment,
  AssessmentEnumOption,
  AssessmentField,
  AssessmentGroup,
  AssessmentRecurrence,
  CreateAssessmentRequest
} from '@arch-register/api-types/assessmentContract';
import type { FilterCondition } from '@arch-register/api-types/viewContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { useFieldGroupAccess } from '../../auth/useFieldGroupAccess';
import { resolveSchemaColor } from '../../lib/schemaPresentation';
import { toFieldId } from '../../utils/fieldId';
import { TypeBadge } from '../../components/TypeBadge';
import { GroupDialog } from '../../components/GroupsEditor';
import { DerivedExpressionTestDialog } from '../../components/DerivedExpressionTestDialog';
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
import { FieldConfig } from '../../components/FieldConfig';
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
  text: { icon: TbAlignLeft, hint: 'free text' },
  derived: { icon: TbDatabase, hint: null }
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
  const { workspaceSlug, lifecycleStates, teams, assessmentTypes } = useWorkspaceContext();
  const getFieldGroupAccess = useFieldGroupAccess(workspaceSlug);
  const portal = usePortal();
  const isNew = !assessment;
  const [name, setName] = useState(assessment?.name ?? '');
  const [description, setDescription] = useState(assessment?.description ?? '');
  const [assessmentTypeId, setAssessmentTypeId] = useState<string>(
    assessment?.assessment_type_id ?? ''
  );
  const [scope, setScope] = useState<string[]>(assessment?.scope ?? []);
  const [scopeConditions, setScopeConditions] = useState<FilterCondition[]>(
    assessment?.scope_conditions.map(condition => ({ ...condition })) ?? []
  );
  const [fields, setFields] = useState<AssessmentField[]>(
    assessment?.fields.map(f => ({ ...f })) ?? []
  );
  const fieldKeysRef = useRef(new Map<string, string>());
  const [groups, setGroups] = useState<AssessmentGroup[]>(
    assessment?.groups.map(g => ({ ...g })) ?? []
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
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<AssessmentGroup | null>(null);

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

  const addField = (type: AssessmentField['type'], groupId?: string) => {
    markDirty();
    setFields(prev => {
      const baseId = toFieldId('new_field');
      const id = uniqueAssessmentFieldId(
        baseId,
        prev.map(field => field.id)
      );
      const base = {
        id,
        label: '',
        requirementLevel: 'required' as const,
        ...(groupId && { groupId })
      };
      const inputField = prev.find(field => field.type !== 'derived');
      const nextField: AssessmentField =
        type === 'enum'
          ? { ...base, type, enumId: '' }
          : type === 'derived'
            ? {
                ...base,
                type,
                requirementLevel: 'optional' as const,
                expression: inputField ? `entity.${inputField.id}` : '""',
                resultType: 'text' as const
              }
            : { ...base, type };
      return [...prev, nextField];
    });
  };

  const updateField = (id: string, changes: Partial<AssessmentField>) => {
    markDirty();
    setFields(prev =>
      prev.map(f => {
        if (f.id !== id) return f;
        const next = { ...f, ...changes } as Record<string, unknown>;
        if (
          typeof changes.label === 'string' &&
          (f.id === toFieldId(f.label) || /^new_field(?:_\d+)?$/.test(f.id)) &&
          changes.label.trim() !== ''
        ) {
          next.id = uniqueAssessmentFieldId(
            toFieldId(changes.label) || 'new_field',
            prev.map(field => field.id),
            f.id
          );
          const key = fieldKeysRef.current.get(f.id);
          if (key) fieldKeysRef.current.set(next.id as string, key);
          fieldKeysRef.current.delete(f.id);
        }
        if ('enumId' in changes && changes.enumId === undefined) delete next.enumId;
        if ('options' in changes && changes.options === undefined) delete next.options;
        return next as AssessmentField;
      })
    );
  };

  const removeField = (id: string) => {
    markDirty();
    fieldKeysRef.current.delete(id);
    setFields(prev => prev.filter(f => f.id !== id));
  };

  const fieldKey = (id: string) => {
    const existing = fieldKeysRef.current.get(id);
    if (existing) return existing;
    const key = crypto.randomUUID();
    fieldKeysRef.current.set(id, key);
    return key;
  };

  const openNewGroup = () => {
    setEditingGroup(null);
    setGroupDialogOpen(true);
  };

  const saveGroup = (group: AssessmentGroup) => {
    markDirty();
    setGroups(current =>
      current.some(item => item.id === group.id)
        ? current.map(item => (item.id === group.id ? group : item))
        : [...current, group]
    );
    setGroupDialogOpen(false);
  };

  const removeGroup = (groupId: string) => {
    markDirty();
    setGroups(current => current.filter(g => g.id !== groupId));
    setFields(prev => prev.map(f => (f.groupId === groupId ? { ...f, groupId: undefined } : f)));
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
      setAssessmentTypeId('');
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

  const groupIds = new Set(groups.map(g => g.id));
  const ungroupedFields = fields.filter(f => !f.groupId || !groupIds.has(f.groupId));
  const fieldsByGroup = new Map<string, AssessmentField[]>();
  for (const group of groups) fieldsByGroup.set(group.id, []);
  for (const f of fields) {
    if (f.groupId && groupIds.has(f.groupId)) fieldsByGroup.get(f.groupId)!.push(f);
  }

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
      width={900}
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
                assessment_type_id: assessmentTypeId.trim() || null,
                scope,
                scope_conditions: scopeConditions,
                fields: mode === 'confirm' ? [] : fields,
                groups: mode === 'confirm' ? [] : groups,
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
          <Tabs.Trigger value="assignment">Assignment</Tabs.Trigger>
          <Tabs.Trigger value="scope">Scope</Tabs.Trigger>
          <Tabs.Trigger value="fields">Fields</Tabs.Trigger>
          <Tabs.Trigger value="advanced">Advanced</Tabs.Trigger>
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
            <div className={styles.sectionLabel}>Assessment type</div>
            <div style={{ width: 280 }}>
              <Select.Root
                value={assessmentTypeId}
                onChange={value => {
                  markDirty();
                  setAssessmentTypeId(value ?? '');
                }}
              >
                <Select.Item value="">Uncategorized</Select.Item>
                {assessmentTypes.map(type => (
                  <Select.Item key={type.id} value={type.id}>
                    {type.name}
                  </Select.Item>
                ))}
              </Select.Root>
            </div>
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
        </Tabs.Content>

        <Tabs.Content value="assignment" style={{ height: 'auto' }}>
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
              getFieldGroupAccess={getFieldGroupAccess}
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
                <Button icon={<TbPlus size={11} />} onClick={openNewGroup}>
                  Group
                </Button>
                <MenuButton.Root>
                  <MenuButton.Trigger
                    element={<Button icon={<TbPlus size={11} />}>Field</Button>}
                  />
                  <MenuButton.Menu container={portal}>
                    {FIELD_TYPE_OPTIONS.map(([type, label]) => (
                      <Menu.Item key={type} onClick={() => addField(type)}>
                        {label}
                      </Menu.Item>
                    ))}
                  </MenuButton.Menu>
                </MenuButton.Root>
              </div>
            </div>
            {fields.length === 0 && groups.length === 0 ? (
              <div className={styles.fieldsEmpty}>
                No fields yet — add a Rating, Select, or Notes field above.
              </div>
            ) : (
              <div className={styles.fieldsList}>
                {ungroupedFields.map(field => (
                  <FieldRow
                    key={fieldKey(field.id)}
                    field={field}
                    groups={groups}
                    onUpdate={changes => updateField(field.id, changes)}
                    onRemove={() => removeField(field.id)}
                  />
                ))}
                {groups.map(group => (
                  <div className={styles.groupSection} key={group.id}>
                    <div className={styles.groupHeader}>
                      <div>
                        <div className={styles.groupName}>{group.name}</div>
                        {group.description && (
                          <div className={styles.groupDescription}>{group.description}</div>
                        )}
                      </div>
                      <div className={styles.groupActions}>
                        <MenuButton.Root>
                          <MenuButton.Trigger
                            element={
                              <Button variant="ghost" icon={<TbPlus size={11} />}>
                                Add field
                              </Button>
                            }
                          />
                          <MenuButton.Menu container={portal}>
                            {FIELD_TYPE_OPTIONS.map(([type, label]) => (
                              <Menu.Item key={type} onClick={() => addField(type, group.id)}>
                                {label}
                              </Menu.Item>
                            ))}
                          </MenuButton.Menu>
                        </MenuButton.Root>
                        <Button
                          variant="ghost"
                          icon={<TbEdit size={12} />}
                          onClick={() => {
                            setEditingGroup(group);
                            setGroupDialogOpen(true);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          icon={<TbTrash size={12} />}
                          onClick={() => removeGroup(group.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                    {(fieldsByGroup.get(group.id) ?? []).length > 0 ? (
                      (fieldsByGroup.get(group.id) ?? []).map(field => (
                        <FieldRow
                          key={fieldKey(field.id)}
                          field={field}
                          groups={groups}
                          onUpdate={changes => updateField(field.id, changes)}
                          onRemove={() => removeField(field.id)}
                        />
                      ))
                    ) : (
                      <div className={styles.groupEmpty}>No fields in this group.</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Tabs.Content>

        <Tabs.Content value="advanced" style={{ height: 'auto' }}>
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
    </Dialog>,
    <GroupDialog
      key="group-editor"
      open={groupDialogOpen}
      onClose={() => setGroupDialogOpen(false)}
      onSave={saveGroup}
      group={editingGroup}
      groups={groups}
    />
  ];
};

const FIELD_TYPE_OPTIONS: [AssessmentField['type'], string][] = [
  ['rating', 'Rating'],
  ['enum', 'Select'],
  ['text', 'Notes'],
  ['derived', 'Derived']
];

const NO_GROUP = '__no_group__';

const uniqueAssessmentFieldId = (baseId: string, existingIds: string[], currentId?: string) => {
  const occupied = new Set(existingIds.filter(id => id !== currentId));
  if (!occupied.has(baseId)) return baseId;
  let suffix = 2;
  while (occupied.has(`${baseId}_${suffix}`)) suffix += 1;
  return `${baseId}_${suffix}`;
};

const FieldRow = ({
  field,
  groups,
  onUpdate,
  onRemove
}: {
  field: AssessmentField;
  groups: AssessmentGroup[];
  onUpdate: (changes: Partial<AssessmentField>) => void;
  onRemove: () => void;
}) => {
  const { enums } = useWorkspaceContext();
  const portal = usePortal();
  const [inlineOptionsOpen, setInlineOptionsOpen] = useState(false);
  const [expressionTestOpen, setExpressionTestOpen] = useState(false);
  const [draftInlineOptions, setDraftInlineOptions] = useState<AssessmentEnumOption[]>([]);
  const meta = FIELD_TYPE_META[field.type];
  const Icon = meta.icon;
  const placeholders: Record<AssessmentField['type'], string> = {
    rating: 'Rating label…',
    enum: 'Select label…',
    text: 'Notes label…',
    derived: 'Derived label…'
  };

  const options = (() => {
    if (field.type === 'enum') {
      return (
        <>
          <FormElement label="Source">
            <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
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
            </span>
          </FormElement>
          {!('options' in field) && (
            <FormElement label="Enum">
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
            </FormElement>
          )}
        </>
      );
    }
    if (field.type === 'derived') {
      return (
        <>
          <FormElement label="Result type">
            <Select.Root
              value={field.resultType}
              onChange={value =>
                onUpdate({
                  resultType: (value ?? 'text') as Extract<
                    AssessmentField,
                    { type: 'derived' }
                  >['resultType'],
                  enumId: undefined,
                  options: undefined
                } as Partial<AssessmentField>)
              }
            >
              <Select.Item value="text">Text</Select.Item>
              <Select.Item value="number">Number</Select.Item>
              <Select.Item value="select">Select</Select.Item>
              <Select.Item value="boolean">Boolean</Select.Item>
              <Select.Item value="rating">Rating</Select.Item>
            </Select.Root>
          </FormElement>
          {field.resultType === 'select' && (
            <FormElement label="Source">
              <Select.Root
                value={'options' in field ? 'inline' : 'workspace'}
                onChange={value =>
                  onUpdate(
                    value === 'inline'
                      ? { options: [{ value: 'option_1', label: '' }], enumId: undefined }
                      : { enumId: enums[0]?.id ?? '', options: undefined }
                  )
                }
              >
                <Select.Item value="workspace">Existing enum</Select.Item>
                <Select.Item value="inline">Inline values</Select.Item>
              </Select.Root>
            </FormElement>
          )}
          <FormElement
            label="Expression"
            hint="Reference response fields through assessment.field or assessment['field-id']"
          >
            <TextInput
              value={field.expression}
              onChange={value => onUpdate({ expression: value ?? '' })}
              placeholder="assessment.input_field"
            />
          </FormElement>
        </>
      );
    }
    return undefined;
  })();

  const menu = (
    <MenuButton.Root>
      <MenuButton.Trigger
        element={<Button variant="ghost" icon={<TbDots size={13} />} title="More field actions" />}
      />
      <MenuButton.Menu container={portal}>
        <Menu.SubMenu label="Move to group" container={portal}>
          <Menu.RadioGroup value={field.groupId ?? NO_GROUP}>
            <Menu.RadioItem value={NO_GROUP} onClick={() => onUpdate({ groupId: undefined })}>
              No group
            </Menu.RadioItem>
            {groups.map(group => (
              <Menu.RadioItem
                key={group.id}
                value={group.id}
                onClick={() => onUpdate({ groupId: group.id })}
              >
                {group.name}
              </Menu.RadioItem>
            ))}
          </Menu.RadioGroup>
        </Menu.SubMenu>
        <Menu.Separator />
        {field.type === 'derived' && (
          <Menu.Item onClick={() => setExpressionTestOpen(true)}>Test expression</Menu.Item>
        )}
        {field.type === 'derived' && <Menu.Separator />}
        <Menu.Item type="danger" onClick={onRemove}>
          Delete field
        </Menu.Item>
      </MenuButton.Menu>
    </MenuButton.Root>
  );

  return (
    <>
      <FieldConfig dragHandle options={options} menu={menu}>
        <FieldConfig.Cell label="Id" mono flexBasis={140}>
          <TextInput
            value={field.id}
            onChange={v => onUpdate({ id: v ?? field.id })}
            style={{ width: '100%' }}
          />
        </FieldConfig.Cell>
        <FieldConfig.Cell label="Label" flexBasis={200}>
          <TextInput
            value={field.label}
            onChange={v => onUpdate({ label: v ?? '' })}
            placeholder={placeholders[field.type]}
            style={{ width: '100%' }}
          />
        </FieldConfig.Cell>
        <FieldConfig.Cell label="Type" flexBasis={130}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon size={13} />
            {FIELD_TYPE_OPTIONS.find(([type]) => type === field.type)?.[1]}
            {meta.hint && <span className={styles.fieldHint}>{meta.hint}</span>}
          </span>
        </FieldConfig.Cell>
        <FieldConfig.Cell label="Completeness" flexBasis={120}>
          <Select.Root
            value={field.requirementLevel}
            disabled={field.type === 'derived'}
            onChange={v =>
              onUpdate({ requirementLevel: (v ?? 'required') as 'required' | 'optional' })
            }
            style={{ width: '100%' }}
          >
            <Select.Item value="required">Required</Select.Item>
            <Select.Item value="optional">Optional</Select.Item>
          </Select.Root>
        </FieldConfig.Cell>
      </FieldConfig>
      {field.type === 'derived' && (
        <DerivedExpressionTestDialog
          open={expressionTestOpen}
          field={field}
          expression={field.expression}
          root="assessment"
          onClose={() => setExpressionTestOpen(false)}
          onSave={expression => {
            onUpdate({ expression });
            setExpressionTestOpen(false);
          }}
        />
      )}
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
    </>
  );
};
