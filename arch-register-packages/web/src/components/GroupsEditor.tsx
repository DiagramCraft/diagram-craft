import { useEffect, useState } from 'react';
import { Button } from '@diagram-craft/app-components/Button';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { Select } from '@diagram-craft/app-components/Select';
import { TbEdit, TbPlus, TbTrash } from 'react-icons/tb';
import type { NamedGroup } from '@arch-register/api-types/common';
import type { SharedFieldGroup } from '@arch-register/api-types/fieldGroupContract';
import { Banner } from './Banner';
import styles from './GroupsEditor.module.css';

export const GroupsEditor = ({
  groups,
  onChange,
  onDeleteGroup,
  canEdit,
  title = 'Groups'
}: {
  groups: NamedGroup[];
  onChange: (groups: NamedGroup[]) => void;
  onDeleteGroup?: (groupId: string) => void;
  canEdit: boolean;
  title?: string;
}) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<NamedGroup | null>(null);

  const saveGroup = (group: NamedGroup) => {
    onChange(
      groups.some(item => item.id === group.id)
        ? groups.map(item => (item.id === group.id ? group : item))
        : [...groups, group]
    );
    setDialogOpen(false);
  };

  const deleteGroup = (groupId: string) => {
    onChange(groups.filter(item => item.id !== groupId));
    onDeleteGroup?.(groupId);
  };

  return (
    <>
      <div className={styles.head}>
        <div className={styles.sectionLabel}>{title}</div>
        {canEdit && (
          <Button
            variant="ghost"
            icon={<TbPlus size={11} />}
            onClick={() => {
              setEditingGroup(null);
              setDialogOpen(true);
            }}
          >
            Add group
          </Button>
        )}
      </div>
      <div className={styles.list}>
        {groups.length === 0 ? (
          <div className={styles.empty}>No groups defined.</div>
        ) : (
          groups.map(group => (
            <div className={styles.row} key={group.id}>
              <div>
                <div className={styles.name}>{group.name}</div>
                {group.description && <div className={styles.description}>{group.description}</div>}
              </div>
              {canEdit && (
                <div className={styles.actions}>
                  <Button
                    variant="ghost"
                    icon={<TbEdit size={12} />}
                    onClick={() => {
                      setEditingGroup(group);
                      setDialogOpen(true);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    icon={<TbTrash size={12} />}
                    onClick={() => deleteGroup(group.id)}
                  >
                    Delete
                  </Button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
      <GroupDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSave={saveGroup}
        group={editingGroup}
        groups={groups}
      />
    </>
  );
};

export const GroupDialog = ({
  open,
  onClose,
  onSave,
  group,
  groups,
  sharedGroups = [],
  onAddSharedGroup
}: {
  open: boolean;
  onClose: () => void;
  onSave: (group: NamedGroup) => void;
  group: NamedGroup | null;
  groups: NamedGroup[];
  sharedGroups?: SharedFieldGroup[];
  onAddSharedGroup?: (groupId: string) => void;
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'new' | 'shared'>('new');
  const [selectedSharedGroupId, setSelectedSharedGroupId] = useState<string | undefined>();

  useEffect(() => {
    if (!open) return;
    setName(group?.name ?? '');
    setDescription(group?.description ?? '');
    setError('');
    setMode(group ? 'new' : 'new');
    setSelectedSharedGroupId(sharedGroups[0]?.id);
  }, [open, group, sharedGroups]);

  const addSharedGroup = () => {
    if (!selectedSharedGroupId || !onAddSharedGroup) {
      setError('Select a shared fieldgroup');
      return;
    }
    onAddSharedGroup(selectedSharedGroupId);
  };

  const save = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Group name is required');
      return;
    }
    if (
      groups.some(
        item => item.id !== group?.id && item.name.toLowerCase() === trimmedName.toLowerCase()
      )
    ) {
      setError(`A group named "${trimmedName}" already exists`);
      return;
    }
    const trimmedDescription = description.trim();
    onSave({
      id: group?.id ?? crypto.randomUUID(),
      name: trimmedName,
      ...(trimmedDescription ? { description: trimmedDescription } : {})
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={group ? 'Edit group' : 'Add group'}
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: onClose },
        {
          label: group ? 'Update group' : mode === 'shared' ? 'Add shared group' : 'Create group',
          type: 'default',
          onClick: mode === 'shared' ? addSharedGroup : save
        }
      ]}
    >
      <div style={{ display: 'grid', gap: 12 }}>
        {!group && onAddSharedGroup && (
          <FormElement label="Group source">
            <Select.Root
              value={mode}
              onChange={value => setMode(value === 'shared' ? 'shared' : 'new')}
            >
              <Select.Item value="new">Create new group</Select.Item>
              <Select.Item value="shared">Add shared group</Select.Item>
            </Select.Root>
          </FormElement>
        )}
        {!group && mode === 'shared' ? (
          <FormElement label="Shared fieldgroup" required>
            <Select.Root
              value={selectedSharedGroupId}
              onChange={setSelectedSharedGroupId}
              placeholder="Select shared fieldgroup..."
            >
              {sharedGroups.map(sharedGroup => (
                <Select.Item key={sharedGroup.id} value={sharedGroup.id}>
                  {sharedGroup.name}
                </Select.Item>
              ))}
            </Select.Root>
          </FormElement>
        ) : (
          <>
            <FormElement label="Group name" required>
              <TextInput
                value={name}
                onChange={value => setName(value ?? '')}
                placeholder="Group name"
                style={{ width: '100%' }}
              />
            </FormElement>
            <FormElement label="Description" required={false}>
              <TextArea
                value={description}
                onChange={value => setDescription(value ?? '')}
                rows={3}
                style={{ width: '100%' }}
              />
            </FormElement>
          </>
        )}
        {error && <Banner variant="error">{error}</Banner>}
      </div>
    </Dialog>
  );
};
