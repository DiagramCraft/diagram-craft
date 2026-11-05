import type { ReactNode, RefCallback } from 'react';
import { Button } from '@diagram-craft/app-components/Button';
import { MenuButton } from '@diagram-craft/app-components/MenuButton';
import { Menu } from '@diagram-craft/app-components/Menu';
import { TbDots, TbLock, TbPlus } from 'react-icons/tb';
import { resolveGroupAccessControl } from '../../lib/fieldGroupAccess';
import { GroupedListEditor } from '../../components/GroupedListEditor';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { useCanEditSchemas, useSchemaEditor } from './schemaEditorContext';
import type { EditorField, EditorGroup } from './schemaEditorState';
import styles from './SchemaSettingsScreen.module.css';

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

export type FieldGroupsEditorProps<Field extends FieldGroupsEditorField> = {
  renderField: (
    field: Field,
    options: { inherited: boolean; canEdit: boolean },
    drag: { ref: RefCallback<HTMLElement> }
  ) => ReactNode;
};

/**
 * Fields grouped by field group, with add / edit / access / delete actions. Reads the draft and
 * its operations from the surrounding `SchemaEditorProvider`; callers only say how to render a
 * field row.
 */
export function FieldGroupsEditor<
  Field extends FieldGroupsEditorField,
  Group extends FieldGroupsEditorGroup
>({ renderField }: FieldGroupsEditorProps<Field>) {
  const editor = useSchemaEditor<Field & EditorField, Group & EditorGroup>();
  const canEdit = useCanEditSchemas();
  const { teams } = useWorkspaceContext();
  const { fieldKeys } = editor;
  const fields: Field[] = editor.draft?.fields ?? [];
  const groups: Group[] = editor.draft?.groups ?? [];
  const sharedFieldGroupLinks = editor.draft?.sharedFieldGroupLinks ?? [];

  const isInherited = (groupId: string) =>
    sharedFieldGroupLinks.some(link => link.groupId === groupId);

  return (
    <>
      <div className={styles.fieldsHead}>
        <div className={styles.sectionLabel}>Fields</div>
        {canEdit && (
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="ghost" icon={<TbPlus size={11} />} onClick={editor.addGroup}>
              Add group
            </Button>
            <Button variant="ghost" icon={<TbPlus size={11} />} onClick={() => editor.addField()}>
              Add field
            </Button>
          </div>
        )}
      </div>

      {fields.length > 0 || groups.length > 0 ? (
        <GroupedListEditor
          className={styles.fieldsTable}
          groupClassName={styles.groupSection}
          items={fields}
          groups={groups}
          getGroupId={field => field.groupId}
          getId={field => fieldKeys.get(field.id) ?? field.id}
          onMove={(bucket, from, to) =>
            editor.reorderFields(
              bucket.map(field => field.id),
              from,
              to
            )
          }
          renderGroupHeader={group => {
            const inherited = isInherited(group.id);
            const teamIds = resolveGroupAccessControl(group, sharedFieldGroupLinks)?.teamIds ?? [];
            return (
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
                        onClick={() => editor.addField(group.id)}
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
                        <Menu.Item disabled={inherited} onClick={() => editor.editGroup(group)}>
                          Edit
                        </Menu.Item>
                        <Menu.Item onClick={() => editor.setAccessDialogGroupId(group.id)}>
                          Change access
                        </Menu.Item>
                        <Menu.Separator />
                        <Menu.Item
                          type="danger"
                          onClick={() =>
                            inherited
                              ? editor.removeSharedFieldGroup(group.id)
                              : editor.removeGroup(group.id)
                          }
                        >
                          Delete
                        </Menu.Item>
                      </MenuButton.Menu>
                    </MenuButton.Root>
                  </div>
                )}
              </div>
            );
          }}
          renderEmpty={() => <div className={styles.groupEmpty}>No fields in this group.</div>}
          renderItem={(field, ctx) => {
            const inherited = field.groupId !== undefined && isInherited(field.groupId);
            return renderField(
              field,
              { inherited, canEdit: canEdit && !inherited },
              { ref: ctx.dragRef }
            );
          }}
        />
      ) : (
        <div className={styles.fieldsEmpty}>
          No fields defined yet. Click &quot;Add field&quot; to get started.
        </div>
      )}
    </>
  );
}
