import { Button } from '@diagram-craft/app-components/Button';
import { MenuButton } from '@diagram-craft/app-components/MenuButton';
import { Menu } from '@diagram-craft/app-components/Menu';
import { TbDots, TbLock, TbPlus } from 'react-icons/tb';
import type {
  EntitySchema,
  SchemaField,
  SchemaGroup,
  SharedFieldGroupLink
} from '@arch-register/api-types/schemaContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type { WorkspaceEnum } from '@arch-register/api-types/enumContract';
import { resolveGroupAccessControl } from '../../lib/fieldGroupAccess';
import type { FieldType } from '../../lib/schemaPresentation';
import { SchemaFieldRow } from './SchemaFieldRow';
import styles from './SchemaSettingsScreen.module.css';

type Team = { id: string; name: string };

export const SchemaFieldsEditor = ({
  fields,
  groups,
  sharedFieldGroupLinks,
  fieldKeys,
  schemas,
  relationSchemas,
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
}: {
  fields: SchemaField[];
  groups: SchemaGroup[];
  sharedFieldGroupLinks: SharedFieldGroupLink[];
  fieldKeys: ReadonlyMap<string, string>;
  schemas: EntitySchema[];
  relationSchemas: RelationSchema[];
  enums: WorkspaceEnum[];
  teams: Team[];
  canEdit: boolean;
  onAddField: (groupId?: string) => void;
  onAddGroup: () => void;
  onUpdateField: (fieldId: string, patch: Partial<SchemaField>) => void;
  onChangeFieldType: (fieldId: string, type: FieldType) => void;
  onRemoveField: (fieldId: string) => void;
  onEditGroup: (group: SchemaGroup) => void;
  onAccessGroup: (groupId: string) => void;
  onRemoveGroup: (groupId: string) => void;
  onRemoveSharedGroup: (groupId: string) => void;
}) => {
  const groupIds = new Set(groups.map(group => group.id));
  const ungroupedFields = fields.filter(field => !field.groupId || !groupIds.has(field.groupId));
  const fieldsByGroup = new Map<string, SchemaField[]>();
  for (const group of groups) fieldsByGroup.set(group.id, []);
  for (const field of fields) {
    if (field.groupId && groupIds.has(field.groupId)) fieldsByGroup.get(field.groupId)!.push(field);
  }

  const renderFieldRow = (field: SchemaField) => {
    const inherited =
      field.groupId != null && sharedFieldGroupLinks.some(link => link.groupId === field.groupId);
    const containmentDisabled = fields.some(
      other => other.id !== field.id && other.type === 'containment'
    );
    return (
      <SchemaFieldRow
        key={fieldKeys.get(field.id) ?? field.id}
        field={field}
        schemas={schemas}
        relationSchemas={relationSchemas}
        enums={enums}
        groups={groups}
        onUpdate={patch => onUpdateField(field.id, patch)}
        onChangeType={type => onChangeFieldType(field.id, type)}
        onRemove={canEdit && !inherited ? () => onRemoveField(field.id) : undefined}
        containmentDisabled={containmentDisabled}
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
