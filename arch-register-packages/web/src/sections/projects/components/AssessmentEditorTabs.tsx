import { Button } from '@diagram-craft/app-components/Button';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { Menu } from '@diagram-craft/app-components/Menu';
import { MenuButton } from '@diagram-craft/app-components/MenuButton';
import { Select } from '@diagram-craft/app-components/Select';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { usePortal } from '@diagram-craft/app-components/PortalContext';
import { TbEdit, TbPlus, TbTrash } from 'react-icons/tb';
import type { Assessment } from '@arch-register/api-types/assessmentContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import { TypeBadge } from '../../../components/TypeBadge';
import { GroupDialog } from '../../../components/GroupsEditor';
import { UserGroupPicker } from '../../../components/UserGroupPicker';
import { AssessmentScopeFilterBuilder } from './AssessmentScopeFilterBuilder';
import { PickedTeams } from './AssessmentList';
import { AssessmentFieldRow, FIELD_TYPE_OPTIONS } from './AssessmentFieldRow';
import type { AssessmentEditorController } from './assessmentEditorState';
import styles from '../ProjectAssessments.module.css';

export const AssessmentEditorTabs = ({
  editor,
  schemas
}: {
  editor: AssessmentEditorController;
  schemas: EntitySchema[];
}) => (
  <Tabs.Root defaultValue="basic-info">
    <Tabs.List aria-label="Assessment editor sections">
      <Tabs.Trigger value="basic-info">Basic Info</Tabs.Trigger>
      <Tabs.Trigger value="assignment">Assignment</Tabs.Trigger>
      <Tabs.Trigger value="scope">Scope</Tabs.Trigger>
      <Tabs.Trigger value="fields">Fields</Tabs.Trigger>
      <Tabs.Trigger value="advanced">Advanced</Tabs.Trigger>
    </Tabs.List>

    <Tabs.Content value="basic-info" style={{ height: 'auto' }}>
      <AssessmentBasicInfoTab editor={editor} />
    </Tabs.Content>
    <Tabs.Content value="assignment" style={{ height: 'auto' }}>
      <AssessmentAssignmentTab editor={editor} />
    </Tabs.Content>
    <Tabs.Content value="scope" style={{ height: 'auto' }}>
      <AssessmentScopeTab editor={editor} schemas={schemas} />
    </Tabs.Content>
    <Tabs.Content value="fields" style={{ height: 'auto' }}>
      <AssessmentFieldsTab editor={editor} />
    </Tabs.Content>
    <Tabs.Content value="advanced" style={{ height: 'auto' }}>
      <AssessmentAdvancedTab editor={editor} />
    </Tabs.Content>
  </Tabs.Root>
);

export const AssessmentBasicInfoTab = ({ editor }: { editor: AssessmentEditorController }) => {
  const { draft, assessmentTypes, actions } = editor;
  return (
    <>
      <div className={styles.section}>
        <div className={styles.sectionLabel}>Description</div>
        <TextInput
          value={draft.description}
          onChange={value => actions.onDescriptionChange(value ?? '')}
          placeholder="Explain the purpose of this assessment"
          style={{ width: '100%' }}
        />
      </div>
      <div className={styles.section}>
        <div className={styles.sectionLabel}>Assessment type</div>
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
      </div>
      <div className={styles.section}>
        <div className={styles.sectionLabel}>Status</div>
        <div style={{ width: 160 }}>
          <Select.Root value={draft.status} onChange={value => actions.onStatusChange(value)}>
            {(['draft', 'open', 'closed', 'archived'] as Assessment['status'][]).map(status => (
              <Select.Item key={status} value={status}>
                {status[0]!.toUpperCase() + status.slice(1)}
              </Select.Item>
            ))}
          </Select.Root>
        </div>
      </div>
      <div className={styles.section}>
        <div className={styles.sectionLabel}>Completion mode</div>
        <div className={styles.sectionHint}>
          Either fill in one or more fields per entity, or simply confirm the existing entity data
          is accurate.
        </div>
        <div className={styles.fieldAddButtons}>
          <Button
            variant={draft.mode === 'fields' ? 'primary' : 'secondary'}
            onClick={() => actions.onModeChange('fields')}
          >
            Fields
          </Button>
          <Button
            variant={draft.mode === 'confirm' ? 'primary' : 'secondary'}
            onClick={() => actions.onModeChange('confirm')}
          >
            Confirm only
          </Button>
        </div>
      </div>
    </>
  );
};

export const AssessmentAssignmentTab = ({ editor }: { editor: AssessmentEditorController }) => {
  const { draft, teamLabels, actions } = editor;
  return (
    <>
      <div className={styles.section}>
        <div className={styles.sectionLabel}>Assigned teams (optional)</div>
        <div className={styles.sectionHint}>
          {draft.status === 'draft'
            ? 'Assigned teams get a governance inbox task to acknowledge this assessment once it opens.'
            : 'Assigned teams and the due date are locked once an assessment is open. Close and reopen it as draft to change them.'}
        </div>
        <PickedTeams
          ids={draft.assignedTeamIds}
          labels={teamLabels}
          onRemove={actions.removeTeam}
        />
        {draft.status === 'draft' && (
          <UserGroupPicker
            kind="team"
            excludeIds={draft.assignedTeamIds}
            onSelect={item => actions.addTeam(item.id)}
            placeholder="Search teams to add…"
          />
        )}
      </div>
      <div className={styles.section}>
        <div className={styles.sectionLabel}>Due date (optional)</div>
        <input
          className={styles.dateInput}
          type="date"
          value={draft.dueAt}
          disabled={draft.status !== 'draft'}
          onChange={event => actions.onDueAtChange(event.target.value)}
        />
      </div>
    </>
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
    <div className={styles.section}>
      <div className={styles.sectionHint}>Which entity types does this assessment apply to?</div>
      <div className={styles.scopeGrid}>
        {schemas.map(schema => {
          const on = draft.scope.includes(schema.id);
          return (
            <button
              key={schema.id}
              type="button"
              className={`${styles.scopeChip} ${on ? styles.scopeChipOn : ''}`}
              onClick={() => actions.toggleScope(schema.id)}
            >
              <TypeBadge color={schema.color ?? '#888'} icon={schema.icon} size={16} />
              <span>{schema.name}</span>
            </button>
          );
        })}
      </div>
      <AssessmentScopeFilterBuilder
        conditions={draft.scopeConditions}
        onChange={conditions => actions.onScopeConditionsChange(conditions)}
        schemas={schemas}
        scope={draft.scope}
        lifecycleStates={lifecycleStates}
        teams={teams}
        getFieldGroupAccess={getFieldGroupAccess}
      />
      <div className={styles.scopePreview}>
        {draft.scope.length === 0
          ? 'No entity types selected.'
          : editor.previewLoading
            ? 'Counting matching entities...'
            : `${editor.previewCount} matching entit${editor.previewCount === 1 ? 'y' : 'ies'}`}
      </div>
      {editor.showScopeWarning && (
        <div className={styles.scopeWarning}>
          Changing scope may add or remove entities from this assessment. Existing responses are
          kept.
        </div>
      )}
    </div>
  );
};

export const AssessmentFieldsTab = ({ editor }: { editor: AssessmentEditorController }) => {
  const portal = usePortal();
  const { draft, actions } = editor;

  const fieldMenu = (groupId?: string) => (
    <MenuButton.Root>
      <MenuButton.Trigger
        element={
          <Button variant={groupId ? 'ghost' : undefined} icon={<TbPlus size={11} />}>
            {groupId ? 'Add field' : 'Field'}
          </Button>
        }
      />
      <MenuButton.Menu container={portal}>
        {FIELD_TYPE_OPTIONS.map(([type, label]) => (
          <Menu.Item key={type} onClick={() => actions.addField(type, groupId)}>
            {label}
          </Menu.Item>
        ))}
      </MenuButton.Menu>
    </MenuButton.Root>
  );

  return (
    <>
      <div className={styles.section}>
        <div className={styles.sectionRow}>
          <div className={styles.sectionLabel}>
            Fields{draft.fields.length > 0 ? ` (${draft.fields.length})` : ''}
          </div>
          <div className={styles.fieldAddButtons}>
            <Button icon={<TbPlus size={11} />} onClick={actions.openNewGroup}>
              Group
            </Button>
            {fieldMenu()}
          </div>
        </div>
        {draft.fields.length === 0 && draft.groups.length === 0 ? (
          <div className={styles.fieldsEmpty}>
            No fields yet — add a Rating, Select, or Notes field above.
          </div>
        ) : (
          <div className={styles.fieldsList}>
            {editor.ungroupedFields.map(field => (
              <AssessmentFieldRow
                key={actions.fieldKey(field.id)}
                field={field}
                groups={draft.groups}
                onUpdate={changes => actions.updateField(field.id, changes)}
                onRemove={() => actions.removeField(field.id)}
              />
            ))}
            {draft.groups.map(group => (
              <div className={styles.groupSection} key={group.id}>
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
                      variant="ghost"
                      icon={<TbEdit size={12} />}
                      onClick={() => actions.openEditGroup(group)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      icon={<TbTrash size={12} />}
                      onClick={() => actions.removeGroup(group.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
                {(editor.fieldsByGroup.get(group.id) ?? []).length > 0 ? (
                  (editor.fieldsByGroup.get(group.id) ?? []).map(field => (
                    <AssessmentFieldRow
                      key={actions.fieldKey(field.id)}
                      field={field}
                      groups={draft.groups}
                      onUpdate={changes => actions.updateField(field.id, changes)}
                      onRemove={() => actions.removeField(field.id)}
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
      <GroupDialog
        open={editor.groupDialogOpen}
        onClose={actions.closeGroupDialog}
        onSave={actions.saveGroup}
        group={editor.editingGroup}
        groups={draft.groups}
      />
    </>
  );
};

export const AssessmentAdvancedTab = ({ editor }: { editor: AssessmentEditorController }) => {
  const { draft, actions } = editor;
  return (
    <div className={styles.section}>
      <div className={styles.sectionLabel}>Recurrence</div>
      <div className={styles.sectionHint}>
        Recurring assessments automatically reopen for a new response cycle once the response window
        elapses.
      </div>
      <div style={{ width: 160 }}>
        <Select.Root
          value={draft.recurrenceType}
          onChange={value => actions.onRecurrenceTypeChange(value)}
        >
          <Select.Item value="none">One-off (no recurrence)</Select.Item>
          <Select.Item value="weekly">Weekly</Select.Item>
          <Select.Item value="monthly">Monthly</Select.Item>
        </Select.Root>
      </div>
      {draft.recurrenceType !== 'none' && (
        <div className={styles.editorTopRow}>
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
    </div>
  );
};
