import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DialogContextProvider } from '@diagram-craft/app-components/Dialog';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import {
  AssessmentAdvancedTab,
  AssessmentAssignmentTab,
  AssessmentBasicInfoTab,
  AssessmentFieldsTab,
  AssessmentScopeTab
} from './AssessmentEditorTabs';
import {
  createInitialAssessmentEditorDraft,
  type AssessmentEditorController
} from './assessmentEditorState';

const schema: EntitySchema = {
  id: 'application',
  workspace: 'workspace-1',
  name: 'Application',
  description: '',
  key_prefix: 'APP',
  color: '#4c8',
  icon: null,
  fields: [],
  templates: [],
  groups: [],
  shared_field_group_links: [],
  entity_capabilities: [],
  validation_rules: [],
  entity_count: 0,
  version: 1,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z'
};

const makeEditor = (): AssessmentEditorController => {
  const draft = createInitialAssessmentEditorDraft(null);
  draft.status = 'open';
  draft.scope = ['application'];
  draft.recurrenceType = 'monthly';
  draft.recurrenceInterval = 2;
  draft.responseWindowDays = '14';

  const actions: AssessmentEditorController['actions'] = {
    onNameChange: () => undefined,
    onDescriptionChange: () => undefined,
    onAssessmentTypeChange: () => undefined,
    onStatusChange: () => undefined,
    onModeChange: () => undefined,
    onDueAtChange: () => undefined,
    onRecurrenceTypeChange: () => undefined,
    onRecurrenceIntervalChange: () => undefined,
    onResponseWindowDaysChange: () => undefined,
    toggleScope: () => undefined,
    onScopeConditionsChange: () => undefined,
    addField: () => undefined,
    updateField: () => undefined,
    removeField: () => undefined,
    fieldKey: id => id,
    openNewGroup: () => undefined,
    openEditGroup: () => undefined,
    closeGroupDialog: () => undefined,
    saveGroup: () => undefined,
    removeGroup: () => undefined,
    addTeam: () => undefined,
    removeTeam: () => undefined,
    selectTemplate: () => undefined,
    applyPendingTemplate: () => undefined,
    cancelPendingTemplate: () => undefined
  };

  return {
    isNew: true,
    draft,
    actions,
    lifecycleStates: [],
    teams: [],
    assessmentTypes: [],
    getFieldGroupAccess: () => 'edit',
    teamLabels: new Map(),
    allowedScopeConditionFields: new Set(),
    previewCount: 2,
    previewLoading: false,
    showScopeWarning: false,
    ungroupedFields: [],
    fieldsByGroup: new Map(),
    recurrence: { type: 'monthly', intervalMonths: 2 },
    responseWindowDaysNumber: 14,
    canSave: true,
    selectedTemplateId: '__start_from_scratch__',
    pendingTemplateId: null,
    groupDialogOpen: false,
    editingGroup: null
  };
};

describe('assessment editor tabs', () => {
  it('renders the basic information controls independently', () => {
    const markup = renderToStaticMarkup(<AssessmentBasicInfoTab editor={makeEditor()} />);

    expect(markup).toContain('Description');
    expect(markup).toContain('Assessment type');
    expect(markup).toContain('Completion mode');
  });

  it('renders locked assignment controls for an open assessment', () => {
    const markup = renderToStaticMarkup(<AssessmentAssignmentTab editor={makeEditor()} />);

    expect(markup).toContain('Assigned teams');
    expect(markup).toContain('Due date');
    expect(markup).toContain('disabled');
    expect(markup).not.toContain('Search teams to add');
  });

  it('renders scope controls and the preview independently', () => {
    const markup = renderToStaticMarkup(
      <AssessmentScopeTab editor={makeEditor()} schemas={[schema]} />
    );

    expect(markup).toContain('Application');
    expect(markup).toContain('Filter Conditions');
    expect(markup).toContain('2 matching entities');
  });

  it('renders the empty fields state and group entry point independently', () => {
    const markup = renderToStaticMarkup(
      <DialogContextProvider onDialogShow={() => undefined} onDialogHide={() => undefined}>
        <AssessmentFieldsTab editor={makeEditor()} />
      </DialogContextProvider>
    );

    expect(markup).toContain('Fields');
    expect(markup).toContain('No fields yet');
    expect(markup).toContain('Group');
  });

  it('renders recurring advanced settings independently', () => {
    const markup = renderToStaticMarkup(<AssessmentAdvancedTab editor={makeEditor()} />);

    expect(markup).toContain('Every N months');
    expect(markup).toContain('Response window (days)');
  });
});
