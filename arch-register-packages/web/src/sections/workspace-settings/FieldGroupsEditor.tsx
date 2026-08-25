import type { ReactNode } from 'react';
import { Button } from '@diagram-craft/app-components/Button';
import { MenuButton } from '@diagram-craft/app-components/MenuButton';
import { Menu } from '@diagram-craft/app-components/Menu';
import { TbDots, TbLock, TbPlus } from 'react-icons/tb';
import type { SharedFieldGroupLink } from '@arch-register/api-types/schemaContract';
import { resolveGroupAccessControl } from '../../lib/fieldGroupAccess';
import { FieldConfigList, type FieldConfigDragHandle } from '../../components/FieldConfigList';
import styles from './SchemaSettingsScreen.module.css';

const UNGROUPED_LIST_ID = '__ungrouped__';

export type FieldGroupsEditorField = {
  id: string;
  groupId?: string;
};

export type FieldGroupsEditorGroup = {
  id: string;
  name: string;
  description?: string;
  accessControl?: { teamIds: string[] };
};

export type FieldGroupsEditorProps<
  Field extends FieldGroupsEditorField,
  Group extends FieldGroupsEditorGroup
> = {
  fields: Field[];
  groups: Group[];
  sharedFieldGroupLinks: SharedFieldGroupLink[];
  fieldKeys: ReadonlyMap<string, string>;
  teams: { id: string; name: string }[];
  canEdit: boolean;
  onAddField: (groupId?: string) => void;
  onAddGroup: () => void;
  onEditGroup: (group: Group) => void;
  onAccessGroup: (groupId: string) => void;
  onRemoveGroup: (groupId: string) => void;
  onRemoveSharedGroup: (groupId: string) => void;
  onReorderField: (bucketFieldIds: string[], fromIndex: number, toIndex: number) => void;
  renderField: (
    field: Field,
    options: { inherited: boolean; canEdit: boolean },
    drag: FieldConfigDragHandle
  ) => ReactNode;
};

export function FieldGroupsEditor<
  Field extends FieldGroupsEditorField,
  Group extends FieldGroupsEditorGroup
>({
  fields,
  groups,
  sharedFieldGroupLinks,
  fieldKeys,
  teams,
  canEdit,
  onAddField,
  onAddGroup,
  onEditGroup,
  onAccessGroup,
  onRemoveGroup,
  onRemoveSharedGroup,
  onReorderField,
  renderField
}: FieldGroupsEditorProps<Field, Group>) {
  const groupIds = new Set(groups.map(group => group.id));
  const ungroupedFields = fields.filter(field => !field.groupId || !groupIds.has(field.groupId));
  const fieldsByGroup = new Map<string, Field[]>();
  for (const group of groups) fieldsByGroup.set(group.id, []);
  for (const field of fields) {
    if (field.groupId && groupIds.has(field.groupId)) fieldsByGroup.get(field.groupId)!.push(field);
  }

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
          <FieldConfigList
            items={ungroupedFields}
            getId={field => fieldKeys.get(field.id) ?? field.id}
            listId={UNGROUPED_LIST_ID}
            onReorder={(from, to) =>
              onReorderField(
                ungroupedFields.map(field => field.id),
                from,
                to
              )
            }
            renderItem={(field, _index, drag) =>
              renderField(field, { inherited: false, canEdit }, drag)
            }
          />
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
                  <FieldConfigList
                    items={groupFields}
                    getId={field => fieldKeys.get(field.id) ?? field.id}
                    listId={group.id}
                    onReorder={(from, to) =>
                      onReorderField(
                        groupFields.map(field => field.id),
                        from,
                        to
                      )
                    }
                    renderItem={(field, _index, drag) =>
                      renderField(field, { inherited, canEdit: canEdit && !inherited }, drag)
                    }
                  />
                ) : (
                  <div className={styles.groupEmpty}>No fields in this group.</div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className={styles.fieldsEmpty}>
          No fields defined yet. Click &quot;Add field&quot; to get started.
        </div>
      )}
    </>
  );
}
