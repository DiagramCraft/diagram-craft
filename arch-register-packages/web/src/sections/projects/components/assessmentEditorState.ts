import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  Assessment,
  AssessmentField,
  AssessmentGroup,
  AssessmentRecurrence,
  CreateAssessmentRequest
} from '@arch-register/api-types/assessmentContract';
import type {
  AssessmentType,
  WorkspaceTeam
} from '@arch-register/api-types/workspaceConfigContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import type { FilterCondition } from '@arch-register/api-types/viewContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import {
  useWorkspaceAuthorization,
  type WorkspaceAuthorization
} from '../../../auth/WorkspaceAuthorizationContext';
import { toFieldId } from '../../../utils/fieldId';
import { useEntityCountsBySchema } from '../../../hooks/useEntities';
import {
  assessmentTemplates,
  cloneAssessmentTemplateValues
} from '../../../lib/assessmentTemplates';

export type AssessmentFormData = Omit<CreateAssessmentRequest, 'project_id'>;

export type AssessmentEditorDraft = {
  name: string;
  description: string;
  assessmentTypeId: string;
  scope: string[];
  scopeConditions: FilterCondition[];
  fields: AssessmentField[];
  groups: AssessmentGroup[];
  assignedTeamIds: string[];
  dueAt: string;
  recurrenceType: AssessmentRecurrence['type'];
  recurrenceInterval: number;
  responseWindowDays: string;
  status: Assessment['status'];
  mode: Assessment['mode'];
};

export type AssessmentEditorActions = {
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onAssessmentTypeChange: (value: string | undefined) => void;
  onStatusChange: (value: string | undefined) => void;
  onModeChange: (value: Assessment['mode']) => void;
  onDueAtChange: (value: string) => void;
  onRecurrenceTypeChange: (value: string | undefined) => void;
  onRecurrenceIntervalChange: (value: string) => void;
  onResponseWindowDaysChange: (value: string) => void;
  toggleScope: (id: string) => void;
  onScopeConditionsChange: (conditions: FilterCondition[]) => void;
  addField: (type: AssessmentField['type'], groupId?: string) => void;
  updateField: (id: string, changes: Partial<AssessmentField>) => void;
  removeField: (id: string) => void;
  fieldKey: (id: string) => string;
  openNewGroup: () => void;
  openEditGroup: (group: AssessmentGroup) => void;
  closeGroupDialog: () => void;
  saveGroup: (group: AssessmentGroup) => void;
  removeGroup: (groupId: string) => void;
  addTeam: (id: string) => void;
  removeTeam: (id: string) => void;
  selectTemplate: (value: string | undefined) => void;
  applyPendingTemplate: () => void;
  cancelPendingTemplate: () => void;
};

export type AssessmentEditorController = {
  isNew: boolean;
  draft: AssessmentEditorDraft;
  actions: AssessmentEditorActions;
  lifecycleStates: WorkspaceLifecycleState[];
  teams: WorkspaceTeam[];
  assessmentTypes: AssessmentType[];
  getFieldGroupAccess: WorkspaceAuthorization['getFieldGroupAccess'];
  teamLabels: Map<string, string>;
  allowedScopeConditionFields: Set<string>;
  previewCount: number;
  previewLoading: boolean;
  showScopeWarning: boolean;
  ungroupedFields: AssessmentField[];
  fieldsByGroup: Map<string, AssessmentField[]>;
  recurrence: AssessmentRecurrence;
  responseWindowDaysNumber: number | null;
  canSave: boolean;
  selectedTemplateId: string;
  pendingTemplateId: string | null;
  groupDialogOpen: boolean;
  editingGroup: AssessmentGroup | null;
};

export const START_FROM_SCRATCH = '__start_from_scratch__';

export const createInitialAssessmentEditorDraft = (
  assessment: Assessment | null
): AssessmentEditorDraft => ({
  name: assessment?.name ?? '',
  description: assessment?.description ?? '',
  assessmentTypeId: assessment?.assessment_type_id ?? '',
  scope: assessment?.scope ? [...assessment.scope] : [],
  scopeConditions: assessment?.scope_conditions.map(condition => ({ ...condition })) ?? [],
  fields: assessment?.fields.map(field => ({ ...field })) ?? [],
  groups: assessment?.groups.map(group => ({ ...group })) ?? [],
  assignedTeamIds: assessment?.assigned_team_ids ? [...assessment.assigned_team_ids] : [],
  dueAt: assessment?.due_at?.slice(0, 10) ?? '',
  recurrenceType: assessment?.recurrence.type ?? 'none',
  recurrenceInterval:
    assessment?.recurrence.type === 'weekly'
      ? assessment.recurrence.intervalWeeks
      : assessment?.recurrence.type === 'monthly'
        ? assessment.recurrence.intervalMonths
        : 1,
  responseWindowDays:
    assessment?.response_window_days != null ? String(assessment.response_window_days) : '',
  status: assessment?.status ?? 'draft',
  mode: assessment?.mode ?? 'fields'
});

export const getAssessmentRecurrence = (
  draft: Pick<AssessmentEditorDraft, 'recurrenceType' | 'recurrenceInterval'>
): AssessmentRecurrence =>
  draft.recurrenceType === 'weekly'
    ? { type: 'weekly', intervalWeeks: draft.recurrenceInterval }
    : draft.recurrenceType === 'monthly'
      ? { type: 'monthly', intervalMonths: draft.recurrenceInterval }
      : { type: 'none' };

export const getResponseWindowDaysNumber = (value: string): number | null =>
  value.trim().length > 0 ? Number(value) : null;

export const canSaveAssessmentDraft = (draft: AssessmentEditorDraft): boolean => {
  const responseWindowDaysNumber = getResponseWindowDaysNumber(draft.responseWindowDays);
  return (
    draft.name.trim().length > 0 &&
    (draft.recurrenceType === 'none' ||
      (responseWindowDaysNumber != null && responseWindowDaysNumber > 0))
  );
};

export const buildAssessmentFormData = (draft: AssessmentEditorDraft): AssessmentFormData => ({
  name: draft.name.trim(),
  description: draft.description.trim(),
  mode: draft.mode,
  assessment_type_id: draft.assessmentTypeId.trim() || null,
  scope: draft.scope,
  scope_conditions: draft.scopeConditions,
  fields: draft.mode === 'confirm' ? [] : draft.fields,
  groups: draft.mode === 'confirm' ? [] : draft.groups,
  assigned_team_ids: draft.assignedTeamIds,
  due_at: draft.dueAt.length > 0 ? draft.dueAt : null,
  recurrence: getAssessmentRecurrence(draft),
  response_window_days: getResponseWindowDaysNumber(draft.responseWindowDays)
});

export const uniqueAssessmentFieldId = (
  baseId: string,
  existingIds: string[],
  currentId?: string
) => {
  const occupied = new Set(existingIds.filter(id => id !== currentId));
  if (!occupied.has(baseId)) return baseId;
  let suffix = 2;
  while (occupied.has(`${baseId}_${suffix}`)) suffix += 1;
  return `${baseId}_${suffix}`;
};

export const useAssessmentEditorController = ({
  assessment,
  schemas
}: {
  assessment: Assessment | null;
  schemas: EntitySchema[];
}): AssessmentEditorController => {
  const { workspaceSlug, lifecycleStates, teams, assessmentTypes } = useWorkspaceContext();
  const { getFieldGroupAccess } = useWorkspaceAuthorization(workspaceSlug);
  const isNew = !assessment;
  const [draft, setDraft] = useState<AssessmentEditorDraft>(() =>
    createInitialAssessmentEditorDraft(assessment)
  );
  const fieldKeysRef = useRef(new Map<string, string>());
  const [selectedTemplateId, setSelectedTemplateId] = useState(isNew ? START_FROM_SCRATCH : '');
  const [isDirty, setIsDirty] = useState(false);
  const [pendingTemplateId, setPendingTemplateId] = useState<string | null>(null);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<AssessmentGroup | null>(null);

  const markDirty = () => setIsDirty(true);

  const updateDraft = <K extends keyof AssessmentEditorDraft>(
    key: K,
    value: AssessmentEditorDraft[K]
  ) => {
    markDirty();
    setDraft(current => ({ ...current, [key]: value }));
  };

  const allowedScopeConditionFields = useMemo(() => {
    const result = new Set(['_owner', '_lifecycle', '_namespace']);
    for (const schema of schemas.filter(schema => draft.scope.includes(schema.id))) {
      for (const field of schema.fields) {
        if (field.type !== 'reference' && field.type !== 'containment') result.add(field.id);
      }
    }
    return result;
  }, [draft.scope, schemas]);

  useEffect(() => {
    setDraft(current => ({
      ...current,
      scopeConditions: current.scopeConditions.filter(condition =>
        allowedScopeConditionFields.has(condition.fieldId)
      )
    }));
  }, [allowedScopeConditionFields]);

  const scopeCountQueries = useEntityCountsBySchema(
    workspaceSlug,
    draft.scope,
    draft.scopeConditions
  );
  const previewCount = scopeCountQueries.reduce((sum, query) => sum + (query.data?.total ?? 0), 0);
  const previewLoading = scopeCountQueries.some(query => query.isLoading || query.isFetching);
  const hasScopeChanged =
    !!assessment &&
    (JSON.stringify([...assessment.scope].sort()) !== JSON.stringify([...draft.scope].sort()) ||
      JSON.stringify(assessment.scope_conditions) !== JSON.stringify(draft.scopeConditions));
  const showScopeWarning = !!assessment && assessment.response_count > 0 && hasScopeChanged;

  const actions: AssessmentEditorActions = {
    onNameChange: value => updateDraft('name', value),
    onDescriptionChange: value => updateDraft('description', value),
    onAssessmentTypeChange: value => updateDraft('assessmentTypeId', value ?? ''),
    onStatusChange: value => updateDraft('status', (value ?? 'draft') as Assessment['status']),
    onModeChange: value => updateDraft('mode', value),
    onDueAtChange: value => updateDraft('dueAt', value),
    onRecurrenceTypeChange: value =>
      updateDraft('recurrenceType', (value ?? 'none') as AssessmentRecurrence['type']),
    onRecurrenceIntervalChange: value => {
      markDirty();
      const parsed = Number(value);
      setDraft(current => ({
        ...current,
        recurrenceInterval: Number.isFinite(parsed) && parsed > 0 ? parsed : 1
      }));
    },
    onResponseWindowDaysChange: value => updateDraft('responseWindowDays', value),
    toggleScope: id => {
      markDirty();
      setDraft(current => ({
        ...current,
        scope: current.scope.includes(id)
          ? current.scope.filter(scopeId => scopeId !== id)
          : [...current.scope, id]
      }));
    },
    onScopeConditionsChange: conditions => updateDraft('scopeConditions', conditions),
    addField: (type, groupId) => {
      markDirty();
      setDraft(current => {
        const baseId = toFieldId('new_field');
        const id = uniqueAssessmentFieldId(
          baseId,
          current.fields.map(field => field.id)
        );
        const base = {
          id,
          label: '',
          requirementLevel: 'required' as const,
          ...(groupId && { groupId })
        };
        const inputField = current.fields.find(field => field.type !== 'derived');
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
        return { ...current, fields: [...current.fields, nextField] };
      });
    },
    updateField: (id, changes) => {
      markDirty();
      setDraft(current => ({
        ...current,
        fields: current.fields.map(field => {
          if (field.id !== id) return field;
          const next = { ...field, ...changes } as Record<string, unknown>;
          if (
            typeof changes.label === 'string' &&
            (field.id === toFieldId(field.label) || /^new_field(?:_\d+)?$/.test(field.id)) &&
            changes.label.trim() !== ''
          ) {
            next.id = uniqueAssessmentFieldId(
              toFieldId(changes.label) || 'new_field',
              current.fields.map(item => item.id),
              field.id
            );
            const key = fieldKeysRef.current.get(field.id);
            if (key) fieldKeysRef.current.set(next.id as string, key);
            fieldKeysRef.current.delete(field.id);
          }
          if ('enumId' in changes && changes.enumId === undefined) delete next.enumId;
          if ('options' in changes && changes.options === undefined) delete next.options;
          return next as AssessmentField;
        })
      }));
    },
    removeField: id => {
      markDirty();
      fieldKeysRef.current.delete(id);
      setDraft(current => ({
        ...current,
        fields: current.fields.filter(field => field.id !== id)
      }));
    },
    fieldKey: id => {
      const existing = fieldKeysRef.current.get(id);
      if (existing) return existing;
      const key = crypto.randomUUID();
      fieldKeysRef.current.set(id, key);
      return key;
    },
    openNewGroup: () => {
      setEditingGroup(null);
      setGroupDialogOpen(true);
    },
    openEditGroup: group => {
      setEditingGroup(group);
      setGroupDialogOpen(true);
    },
    closeGroupDialog: () => setGroupDialogOpen(false),
    saveGroup: group => {
      markDirty();
      setDraft(current => ({
        ...current,
        groups: current.groups.some(item => item.id === group.id)
          ? current.groups.map(item => (item.id === group.id ? group : item))
          : [...current.groups, group]
      }));
      setGroupDialogOpen(false);
    },
    removeGroup: groupId => {
      markDirty();
      setDraft(current => ({
        ...current,
        groups: current.groups.filter(group => group.id !== groupId),
        fields: current.fields.map(field =>
          field.groupId === groupId ? { ...field, groupId: undefined } : field
        )
      }));
    },
    addTeam: id => {
      markDirty();
      setDraft(current => ({
        ...current,
        assignedTeamIds: current.assignedTeamIds.includes(id)
          ? current.assignedTeamIds
          : [...current.assignedTeamIds, id]
      }));
    },
    removeTeam: id => {
      markDirty();
      setDraft(current => ({
        ...current,
        assignedTeamIds: current.assignedTeamIds.filter(teamId => teamId !== id)
      }));
    },
    selectTemplate: value => {
      const nextTemplateId = value ?? START_FROM_SCRATCH;
      if (nextTemplateId === selectedTemplateId) return;
      if (isDirty) {
        setPendingTemplateId(nextTemplateId);
        return;
      }
      applyTemplate(nextTemplateId);
    },
    applyPendingTemplate: () => {
      if (pendingTemplateId) applyTemplate(pendingTemplateId);
    },
    cancelPendingTemplate: () => setPendingTemplateId(null)
  };

  const applyTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    setPendingTemplateId(null);

    if (templateId === START_FROM_SCRATCH) {
      setDraft(current => ({
        ...current,
        name: '',
        description: '',
        assessmentTypeId: '',
        scope: [],
        scopeConditions: [],
        fields: [],
        status: 'draft',
        mode: 'fields'
      }));
      setIsDirty(false);
      return;
    }

    const template = assessmentTemplates.find(item => item.id === templateId);
    if (!template) return;

    const values = cloneAssessmentTemplateValues(template.values);
    setDraft(current => ({
      ...current,
      name: values.name,
      description: values.description,
      scope: values.scope,
      scopeConditions: values.scope_conditions,
      fields: values.fields,
      status: 'draft',
      mode: values.mode
    }));
    setIsDirty(false);
  };

  const groupIds = new Set(draft.groups.map(group => group.id));
  const ungroupedFields = draft.fields.filter(
    field => !field.groupId || !groupIds.has(field.groupId)
  );
  const fieldsByGroup = new Map<string, AssessmentField[]>();
  for (const group of draft.groups) fieldsByGroup.set(group.id, []);
  for (const field of draft.fields) {
    if (field.groupId && groupIds.has(field.groupId)) fieldsByGroup.get(field.groupId)!.push(field);
  }

  const recurrence = getAssessmentRecurrence(draft);
  const responseWindowDaysNumber = getResponseWindowDaysNumber(draft.responseWindowDays);

  return {
    isNew,
    draft,
    actions,
    lifecycleStates,
    teams,
    assessmentTypes,
    getFieldGroupAccess,
    teamLabels: useMemo(() => new Map(teams.map(team => [team.id, team.name])), [teams]),
    allowedScopeConditionFields,
    previewCount,
    previewLoading,
    showScopeWarning,
    ungroupedFields,
    fieldsByGroup,
    recurrence,
    responseWindowDaysNumber,
    canSave: canSaveAssessmentDraft(draft),
    selectedTemplateId,
    pendingTemplateId,
    groupDialogOpen,
    editingGroup
  };
};
