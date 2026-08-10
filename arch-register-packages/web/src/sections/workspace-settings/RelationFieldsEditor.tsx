import { Button } from '@diagram-craft/app-components/Button';
import { Select } from '@diagram-craft/app-components/Select';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { MenuButton } from '@diagram-craft/app-components/MenuButton';
import { Menu } from '@diagram-craft/app-components/Menu';
import { TbDots, TbLock, TbPlus, TbTrash } from 'react-icons/tb';
import type {
  EntitySchema,
  SharedFieldGroupLink,
  ValidationRule
} from '@arch-register/api-types/schemaContract';
import type {
  RelationField,
  RelationSchemaGroup
} from '@arch-register/api-types/relationSchemaContract';
import type { RelationFieldType } from '../../lib/schemaPresentation';
import { resolveGroupAccessControl } from '../../lib/fieldGroupAccess';
import { RelationFieldRow } from './RelationFieldRow';
import styles from './SchemaSettingsScreen.module.css';

type RelationFieldsEditorProps = {
  fields: RelationField[];
  groups: RelationSchemaGroup[];
  sharedFieldGroupLinks: SharedFieldGroupLink[];
  fieldKeys: ReadonlyMap<string, string>;
  schemas: EntitySchema[];
  enums: { id: string; name: string }[];
  teams: { id: string; name: string }[];
  canEdit: boolean;
  onAddField: (groupId?: string) => void;
  onAddGroup: () => void;
  onUpdateField: (fieldId: string, patch: Partial<RelationField>) => void;
  onChangeFieldType: (fieldId: string, type: RelationFieldType) => void;
  onRemoveField: (fieldId: string) => void;
  onEditGroup: (group: RelationSchemaGroup) => void;
  onAccessGroup: (groupId: string) => void;
  onRemoveGroup: (groupId: string) => void;
  onRemoveSharedGroup: (groupId: string) => void;
};

export const RelationFieldsEditor = ({
  fields,
  groups,
  sharedFieldGroupLinks,
  fieldKeys,
  schemas,
  enums,
  teams,
  canEdit,
  onAddField,
  onAddGroup,
  onUpdateField,
  onChangeFieldType,
  onRemoveField,
  onEditGroup,
  onAccessGroup,
  onRemoveGroup,
  onRemoveSharedGroup
}: RelationFieldsEditorProps) => {
  const groupIds = new Set(groups.map(group => group.id));
  const ungroupedFields = fields.filter(field => !field.groupId || !groupIds.has(field.groupId));
  const fieldsByGroup = new Map<string, RelationField[]>();
  for (const group of groups) fieldsByGroup.set(group.id, []);
  for (const field of fields) {
    if (field.groupId && groupIds.has(field.groupId)) fieldsByGroup.get(field.groupId)!.push(field);
  }

  const renderFieldRow = (field: RelationField) => {
    const inherited =
      field.groupId != null && sharedFieldGroupLinks.some(link => link.groupId === field.groupId);
    return (
      <RelationFieldRow
        key={fieldKeys.get(field.id) ?? field.id}
        field={field}
        schemas={schemas}
        enums={enums}
        groups={groups}
        onUpdate={patch => onUpdateField(field.id, patch)}
        onChangeType={type => onChangeFieldType(field.id, type)}
        onRemove={canEdit && !inherited ? () => onRemoveField(field.id) : undefined}
        canEdit={canEdit && !inherited}
      />
    );
  };

  return (
    <>
      <div className={styles.fieldsHead}>
        <div className={styles.sectionLabel}>Fields</div>
        {canEdit && (
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="ghost" icon={<TbPlus size={11} />} onClick={onAddGroup}>
              Add group
            </Button>
            <Button variant="ghost" icon={<TbPlus size={11} />} onClick={() => onAddField()}>
              Add field
            </Button>
          </div>
        )}
      </div>
      {fields.length > 0 || groups.length > 0 ? (
        <div className={styles.fieldsTable}>
          {ungroupedFields.map(renderFieldRow)}
          {groups.map(group => {
            const inherited = sharedFieldGroupLinks.some(link => link.groupId === group.id);
            const groupFields = fieldsByGroup.get(group.id) ?? [];
            const teamIds = resolveGroupAccessControl(group, sharedFieldGroupLinks)?.teamIds ?? [];
            return (
              <div className={styles.groupSection} key={group.id}>
                <div className={styles.groupHeader}>
                  <div>
                    <div className={styles.groupName}>
                      {group.name}
                      {teamIds.length > 0 && (
                        <span className={styles.restrictedBadge}>
                          <TbLock size={10} />
                          Restricted
                        </span>
                      )}
                    </div>
                    {group.description && (
                      <div className={styles.groupDescription}>{group.description}</div>
                    )}
                    {teamIds.length > 0 && (
                      <div className={styles.restrictedTeams}>
                        Restricted to{' '}
                        {teamIds
                          .map(
                            teamId =>
                              teams.find(team => team.id === teamId)?.name ?? 'Unavailable team'
                          )
                          .join(', ')}
                      </div>
                    )}
                  </div>
                  {canEdit && (
                    <div className={styles.groupActions}>
                      {!inherited && (
                        <Button
                          variant="ghost"
                          icon={<TbPlus size={11} />}
                          onClick={() => onAddField(group.id)}
                        >
                          Add field
                        </Button>
                      )}
                      <MenuButton.Root>
                        <MenuButton.Trigger
                          element={
                            <button type="button" className={styles.iconBtn}>
                              <TbDots size={13} />
                            </button>
                          }
                        />
                        <MenuButton.Menu>
                          <Menu.Item disabled={inherited} onClick={() => onEditGroup(group)}>
                            Edit
                          </Menu.Item>
                          <Menu.Item onClick={() => onAccessGroup(group.id)}>
                            Change access
                          </Menu.Item>
                          <Menu.Separator />
                          <Menu.Item
                            type="danger"
                            onClick={() =>
                              inherited ? onRemoveSharedGroup(group.id) : onRemoveGroup(group.id)
                            }
                          >
                            Delete
                          </Menu.Item>
                        </MenuButton.Menu>
                      </MenuButton.Root>
                    </div>
                  )}
                </div>
                {groupFields.length > 0 ? (
                  groupFields.map(renderFieldRow)
                ) : (
                  <div className={styles.groupEmpty}>No fields in this group.</div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className={styles.fieldsEmpty}>
          No fields defined yet. Click "Add field" to get started.
        </div>
      )}
    </>
  );
};

export const RelationValidationEditor = ({
  rules,
  canEdit,
  onAdd,
  onUpdate,
  onToggle,
  onDelete
}: {
  rules: ValidationRule[];
  canEdit: boolean;
  onAdd: () => void;
  onUpdate: (index: number, patch: Partial<ValidationRule>) => void;
  onToggle: (index: number) => void;
  onDelete: (index: number) => void;
}) => (
  <>
    <div className={styles.fieldsHead}>
      <div className={styles.sectionLabel}>Validation rules</div>
      {canEdit && (
        <Button variant="ghost" icon={<TbPlus size={11} />} onClick={onAdd}>
          Add rule
        </Button>
      )}
    </div>
    <div className={styles.fieldsTable}>
      {rules.map((rule, index) => (
        <div className={styles.formRow} key={rule.id}>
          <TextInput
            value={rule.name}
            disabled={!canEdit}
            onChange={value => onUpdate(index, { name: value ?? '' })}
          />
          <TextArea
            value={rule.expression}
            disabled={!canEdit}
            onChange={value => onUpdate(index, { expression: value ?? '' })}
            rows={2}
          />
          <TextInput
            value={rule.message}
            disabled={!canEdit}
            onChange={value => onUpdate(index, { message: value ?? '' })}
          />
          <Select.Root
            value={rule.severity}
            disabled={!canEdit}
            onChange={value => onUpdate(index, { severity: value as ValidationRule['severity'] })}
          >
            <Select.Item value="error">Blocking error</Select.Item>
            <Select.Item value="warning">Warning</Select.Item>
          </Select.Root>
          <Button variant="ghost" disabled={!canEdit} onClick={() => onToggle(index)}>
            {rule.active ? 'Deactivate' : 'Activate'}
          </Button>
          {canEdit && (
            <Button variant="ghost" icon={<TbTrash size={12} />} onClick={() => onDelete(index)} />
          )}
        </div>
      ))}
    </div>
  </>
);
