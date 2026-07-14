import { useState } from 'react';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { Checkbox } from '@diagram-craft/app-components/Checkbox';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { useAddEntityToCollection, useCollections, useCreateCollection, useRemoveEntityFromCollection } from '../../../hooks/useCollections';

export const CollectionPickerDialog = ({
  open,
  workspaceId,
  entityId,
  entityName,
  onClose
}: {
  open: boolean;
  workspaceId: string;
  entityId: string;
  entityName?: string;
  onClose: () => void;
}) => {
  const { data: collections = [], isLoading } = useCollections(workspaceId, entityId);
  const addEntity = useAddEntityToCollection(workspaceId);
  const removeEntity = useRemoveEntityFromCollection(workspaceId);
  const createCollection = useCreateCollection(workspaceId);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [createNewCollection, setCreateNewCollection] = useState(false);
  const isSaving = addEntity.isPending || removeEntity.isPending || createCollection.isPending;

  const setMembership = (collectionId: string, isMember: boolean) => {
    const mutation = isMember ? addEntity : removeEntity;
    mutation.mutate({ collectionId, entityId });
  };

  const handleSave = async () => {
    if (createNewCollection && !newCollectionName.trim()) return;

    try {
      if (createNewCollection) {
        const collection = await createCollection.mutateAsync({ name: newCollectionName.trim() });
        await addEntity.mutateAsync({ collectionId: collection.id, entityId });
      }
      onClose();
    } catch {
      // Error handling is done by TanStack Query.
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        title="Manage collections"
        sub={entityName ? `Choose collections for ${entityName}.` : undefined}
        buttons={[
          {
            label: 'Save',
            type: 'default',
            onClick: handleSave,
            disabled: isSaving || (createNewCollection && !newCollectionName.trim())
          }
        ]}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {isLoading && <span className="dim">Loading collections…</span>}
          {collections.map(collection => (
            <label
              key={collection.id}
              style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: isSaving ? 'default' : 'pointer' }}
            >
              <Checkbox
                value={collection.isMember ?? false}
                onChange={value => setMembership(collection.id, value ?? false)}
                disabled={isSaving}
              />
              <span style={{ flex: 1 }}>{collection.name}</span>
              <span className="dim mono">{collection.entityCount}</span>
            </label>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Checkbox
              value={createNewCollection}
              onChange={value => setCreateNewCollection(value ?? false)}
              disabled={isSaving || !newCollectionName.trim()}
            />
            <TextInput
              value={newCollectionName}
              onChange={value => {
                const name = value ?? '';
                setNewCollectionName(name);
                setCreateNewCollection(!!name.trim());
              }}
              placeholder="Collection name"
              disabled={isSaving}
              style={{ flex: 1 }}
            />
          </div>
        </div>
      </Dialog>
    </>
  );
};
