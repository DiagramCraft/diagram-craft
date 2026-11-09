import { Button } from '@diagram-craft/app-components/Button';
import { DateInput } from '@diagram-craft/app-components/DateInput';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { MultiSelect } from '@diagram-craft/app-components/MultiSelect';
import { Select } from '@diagram-craft/app-components/Select';
import { ToggleButtonGroup } from '@diagram-craft/app-components/ToggleButtonGroup';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { TbEdit, TbPlus, TbTrash } from 'react-icons/tb';
import type { Assessment } from '@arch-register/api-types/assessmentContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import { TypeBadge } from '../../../components/TypeBadge';
import { Stack } from '../../../components/Stack';
import { FormGroup } from '../../../components/FormGroup';
import { GroupDialog } from '../../../components/GroupsEditor';
import { PrincipalPicker } from '../../../components/PrincipalPicker';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { AssessmentScopeFilterBuilder } from './AssessmentScopeFilterBuilder';
import { AssessmentFieldRow } from './AssessmentFieldRow';
import type { AssessmentEditorController } from './assessmentEditorState';
import { GroupedListEditor } from '../../../components/GroupedListEditor';
import styles from './AssessmentEditorTabs.module.css';
import sharedStyles from './assessment-editor-shared.module.css';

export const AssessmentEditorTabs = ({
  editor,
  schemas
}: {
  editor: AssessmentEditorController;
  schemas: EntitySchema[];
}) => (
  <Tabs.Root autoHeight defaultValue="basic-info">
    <Tabs.List aria-label="Assessment editor sections">
      <Tabs.Trigger value="basic-info">Basic Info</Tabs.Trigger>
      <Tabs.Trigger value="assignment">Assignment</Tabs.Trigger>
      <Tabs.Trigger value="scope">Scope</Tabs.Trigger>
      <Tabs.Trigger value="fields">Fields</Tabs.Trigger>
      <Tabs.Trigger value="advanced">Advanced</Tabs.Trigger>
    </Tabs.List>

    <Tabs.Content value="basic-info" style={{ minHeight: '22rem' }}>
      <AssessmentBasicInfoTab editor={editor} />
    </Tabs.Content>
    <Tabs.Content value="assignment" style={{ minHeight: '22rem' }}>
      <AssessmentAssignmentTab editor={editor} />
    </Tabs.Content>
    <Tabs.Content value="scope" style={{ minHeight: '22rem' }}>
      <AssessmentScopeTab editor={editor} schemas={schemas} />
    </Tabs.Content>
    <Tabs.Content value="fields" style={{ minHeight: '22rem' }}>
      <AssessmentFieldsTab editor={editor} />
    </Tabs.Content>
    <Tabs.Content value="advanced" style={{ minHeight: '22rem' }}>
      <AssessmentAdvancedTab editor={editor} />
    </Tabs.Content>
  </Tabs.Root>
);

export const AssessmentBasicInfoTab = ({ editor }: { editor: AssessmentEditorController }) => {
  const { draft, assessmentTypes, actions } = editor;
  return (
    <Stack>
      <div style={{ display: 'flex', gap: '1rem' }}>
        <FormElement label="Status">
          <div style={{ width: 160 }}>
            <Select.Root value={draft.status} onChange={value => actions.onStatusChange(value)}>
              {(['draft', 'open', 'closed', 'archived'] as Assessment['status'][]).map(status => (
                <Select.Item key={status} value={status}>
                  {status[0]!.toUpperCase() + status.slice(1)}
                </Select.Item>
              ))}
            </Select.Root>
          </div>
        </FormElement>
        <FormElement label="Assessment type">
          <ToggleButtonGroup.Root
            type="single"
            value={draft.mode}
            onChange={value => {
              if (value) actions.onModeChange(value as Assessment['mode']);
            }}
          >
            <ToggleButtonGroup.Item value="fields">Fields</ToggleButtonGroup.Item>
            <ToggleButtonGroup.Item value="confirm">Confirm only</ToggleButtonGroup.Item>
          </ToggleButtonGroup.Root>
        </FormElement>
      </div>
      <FormElement label="Assessment type" required={false}>
        <div style={{ width: 280 }}>
          <Select.Root
            value={draft.assessmentTypeId}
            onChange={value => actions.onAssessmentTypeChange(value)}
          >
            <Select.Item value="">Uncategorized</Select.Item>
            {assessmentTypes.map(type => (
              <Select.Item key={type.id} value={type.id}>
                {type.name}
              </Select.Item>
            ))}
          </Select.Root>
        </div>
      </FormElement>
      <FormElement label="Description" required={false}>
        <TextArea
          value={draft.description}
          onChange={value => actions.onDescriptionChange(value ?? '')}
          placeholder="Explain the purpose of this assessment"
          rows={3}
          style={{ width: '100%' }}
        />
      </FormElement>
    </Stack>
  );
};

export const AssessmentAssignmentTab = ({ editor }: { editor: AssessmentEditorController }) => {
  const { workspaceSlug } = useWorkspaceContext();
  const { draft, actions } = editor;
  return (
    <Stack>
      {draft.status !== 'draft' && (
        <div className={styles.hint}>
          Assigned teams and the due date are locked once an assessment is open. Close and reopen it
          as draft to change them.
        </div>
      )}

      <FormElement
        label="Assigned teams"
        required={false}
        hint={
          'Assigned teams get a governance inbox task to acknowledge this assessment once it opens.'
        }
      >
        <PrincipalPicker
          workspaceSlug={workspaceSlug}
          kind="team"
          values={draft.assignedTeamIds}
          onChange={actions.setTeams}
          disabled={draft.status !== 'draft'}
        />
      </FormElement>
      <FormElement label="Due date" required={false}>
        <DateInput
          value={draft.dueAt}
          disabled={draft.status !== 'draft'}
          onChange={value => actions.onDueAtChange(value ?? '')}
        />
      </FormElement>
    </Stack>
  );
};

export const AssessmentScopeTab = ({
  editor,
  schemas
}: {
  editor: AssessmentEditorController;
  schemas: EntitySchema[];
}) => {
  const { draft, lifecycleStates, teams, getFieldGroupAccess, actions } = editor;
  return (
    <Stack>
      <FormGroup variant={'section'} label={'Scope'}>
        <FormElement label="Entity types" hint="Which entity types does this assessment apply to?">
          <MultiSelect
            selectedValues={draft.scope}
            availableItems={schemas.map(schema => ({ value: schema.id, label: schema.name }))}
            maxSuggestions={schemas.length}
            onSelectionChange={actions.setScope}
            placeholder="Select entity types..."
            renderItem={item => {
              const schema = schemas.find(candidate => candidate.id === item.value);
              return (
                <>
                  <TypeBadge color={schema?.color ?? '#888'} icon={schema?.icon} size={16} />
                  <span style={{ marginLeft: '0.35rem' }}>{item.label}</span>
                </>
              );
            }}
            style={{ width: '100%' }}
          />
        </FormElement>
      </FormGroup>

      <AssessmentScopeFilterBuilder
        conditions={draft.scopeConditions}
        onChange={conditions => actions.onScopeConditionsChange(conditions)}
        schemas={schemas}
        scope={draft.scope}
        lifecycleStates={lifecycleStates}
        teams={teams}
        getFieldGroupAccess={getFieldGroupAccess}
      />

      <FormGroup variant={'section'} label={'Results'}>
        <div className={styles.scopePreview}>
          {draft.scope.length === 0
            ? 'No entity types selected.'
            : editor.previewLoading
              ? 'Counting matching entities...'
              : `${editor.previewCount} matching entit${editor.previewCount === 1 ? 'y' : 'ies'}`}
        </div>
      </FormGroup>
      {editor.showScopeWarning && (
        <div className={styles.scopeWarning}>
          Changing scope may add or remove entities from this assessment. Existing responses are
          kept.
        </div>
      )}
    </Stack>
  );
};

export const AssessmentFieldsTab = ({ editor }: { editor: AssessmentEditorController }) => {
  const { draft, actions } = editor;

  const fieldMenu = (groupId?: string) => (
    <Button size="xs" icon={<TbPlus size={11} />} onClick={() => actions.addField(groupId)}>
      {groupId ? 'Add field' : 'Field'}
    </Button>
  );

  return (
    <Stack>
      <FormGroup
        label="Fields"
        variant={'section'}
        action={
          <>
            <Button size="xs" icon={<TbPlus size={11} />} onClick={actions.openNewGroup}>
              Group
            </Button>
            {fieldMenu()}
          </>
        }
      >
        {draft.fields.length === 0 && draft.groups.length === 0 ? (
          <div className={styles.fieldsEmpty}>No fields yet — add a field above.</div>
        ) : (
          <GroupedListEditor
            className={styles.fieldsList}
            groupClassName={styles.groupSection}
            items={draft.fields}
            groups={draft.groups}
            getGroupId={field => field.groupId}
            getId={field => actions.fieldKey(field.id)}
            onMove={(bucket, from, to) =>
              actions.reorderFields(
                bucket.map(field => field.id),
                from,
                to
              )
            }
            renderGroupHeader={group => (
              <div className={styles.groupHeader}>
                <div>
                  <div className={styles.groupName}>{group.name}</div>
                  {group.description && (
                    <div className={styles.groupDescription}>{group.description}</div>
                  )}
                </div>
                <div className={styles.groupActions}>
                  {fieldMenu(group.id)}
                  <Button
                    size={'xs'}
                    icon={<TbEdit size={11} />}
                    onClick={() => actions.openEditGroup(group)}
                  >
                    Edit
                  </Button>
                  <Button
                    size={'xs'}
                    icon={<TbTrash size={11} />}
                    onClick={() => actions.removeGroup(group.id)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            )}
            renderEmpty={() => <div className={styles.groupEmpty}>No fields in this group.</div>}
            renderItem={(field, ctx) => (
              <AssessmentFieldRow
                field={field}
                groups={draft.groups}
                onUpdate={changes => actions.updateField(field.id, changes)}
                onChangeType={type => actions.changeFieldType(field.id, type)}
                onRemove={() => actions.removeField(field.id)}
                dragHandleRef={ctx.dragRef}
              />
            )}
          />
        )}

        <GroupDialog
          open={editor.groupDialogOpen}
          onClose={actions.closeGroupDialog}
          onSave={actions.saveGroup}
          group={editor.editingGroup}
          groups={draft.groups}
        />
      </FormGroup>
    </Stack>
  );
};

export const AssessmentAdvancedTab = ({ editor }: { editor: AssessmentEditorController }) => {
  const { draft, actions } = editor;
  return (
    <Stack>
      <FormElement
        label="Recurrence"
        hint="The interval sets when each new response cycle opens. The response window sets its due date."
      >
        <ToggleButtonGroup.Root
          type="single"
          value={draft.recurrenceType}
          onChange={value => {
            if (value) actions.onRecurrenceTypeChange(value);
          }}
        >
          <ToggleButtonGroup.Item value="none">One-off</ToggleButtonGroup.Item>
          <ToggleButtonGroup.Item value="weekly">Weekly</ToggleButtonGroup.Item>
          <ToggleButtonGroup.Item value="monthly">Monthly</ToggleButtonGroup.Item>
        </ToggleButtonGroup.Root>
      </FormElement>
      {draft.recurrenceType !== 'none' && (
        <div className={sharedStyles.editorTopRow}>
          <FormElement
            label={draft.recurrenceType === 'weekly' ? 'Every N weeks' : 'Every N months'}
          >
            <TextInput
              value={String(draft.recurrenceInterval)}
              onChange={value => actions.onRecurrenceIntervalChange(value ?? '')}
            />
          </FormElement>
          <FormElement label="Response window (days)" required>
            <TextInput
              value={draft.responseWindowDays}
              onChange={value => actions.onResponseWindowDaysChange(value ?? '')}
              placeholder="e.g. 14"
            />
          </FormElement>
        </div>
      )}
    </Stack>
  );
};
