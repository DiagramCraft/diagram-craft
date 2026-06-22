import { useEffect, useMemo, useState } from 'react';
import { useApplication, useDiagram, useDocument } from '../../../application';
import { DataSchema, SchemaMetadata } from '@diagram-craft/model/diagramDocumentDataSchemas';
import { Checkbox } from '@diagram-craft/app-components/Checkbox';
import { TbChevronDown, TbDots, TbPlus, TbTrash } from 'react-icons/tb';
import { EditSchemaDialog } from '../EditSchemaDialog';
import { MessageDialogCommand } from '@diagram-craft/canvas/context';
import { useRedraw } from '../../hooks/useRedraw';
import styles from './SchemasTab.module.css';
import { DataManagerUndoableFacade } from '@diagram-craft/model/diagramDocumentDataUndoActions';
import { MenuButton } from '@diagram-craft/app-components/MenuButton';
import { Menu } from '@diagram-craft/app-components/Menu';

const getProviderTypeName = (providerId: string): string => {
  switch (providerId) {
    case 'urlDataProvider':
      return 'URL';
    case 'restDataProvider':
      return 'REST API';
    case 'defaultDataProvider':
      return 'Document';
    default:
      return providerId;
  }
};

export const SchemasTab = () => {
  const document = useDocument();
  const diagram = useDiagram();
  const application = useApplication();
  const redraw = useRedraw();
  const [addSchemaDialog, setAddSchemaDialog] = useState<{ open: boolean; providerId?: string }>({
    open: false
  });
  const [editSchemaDialog, setEditSchemaDialog] = useState<{ open: boolean; schema?: DataSchema }>({
    open: false
  });
  const [selectedProviderId, setSelectedProviderId] = useState<string>('all');

  const db = document.data.db;
  const dbUndoable = useMemo(
    () => new DataManagerUndoableFacade(diagram.undoManager, db),
    [diagram.undoManager, db]
  );

  const providers = document.data.providers;

  useEffect(() => {
    document.data._schemas.on('update', redraw);
    return () => document.data._schemas.off('update', redraw);
  }, [document, redraw]);

  const schemas =
    selectedProviderId === 'all'
      ? db.schemas
      : db.schemas.filter(schema => schema.providerId === selectedProviderId);

  const handleAddSchema = async (providerId: string, schema: DataSchema) => {
    try {
      await dbUndoable.addSchema(schema, providerId);
      setAddSchemaDialog({ open: false });
    } catch (error) {
      console.error('Failed to add schema:', error);
    }
  };

  const handleUpdateSchema = async (schema: DataSchema) => {
    try {
      await dbUndoable.updateSchema(editSchemaDialog.schema!, schema);
      setEditSchemaDialog({ open: false });
    } catch (error) {
      console.error('Failed to update schema:', error);
    }
  };

  const handleDeleteSchema = (schema: DataSchema) => {
    application.ui.showDialog(
      new MessageDialogCommand(
        {
          title: 'Delete Schema',
          message: `Are you sure you want to delete schema "${schema.name}"? This will also delete all associated data.`,
          okLabel: 'Delete',
          okType: 'danger',
          cancelLabel: 'Cancel'
        },
        async () => {
          try {
            await dbUndoable.deleteSchema(schema);
          } catch (error) {
            console.error('Failed to delete schema:', error);
          }
        }
      )
    );
  };

  const getFieldNamesDisplay = (schema: DataSchema): string => {
    const fieldNames = schema.fields.map(f => f.name);
    return fieldNames.join(', ');
  };

  const handleMetadataChange = (schemaId: string, field: keyof SchemaMetadata, value: boolean) => {
    const currentMetadata = document.data.getSchemaMetadata(schemaId);
    const updatedMetadata: SchemaMetadata = {
      ...currentMetadata,
      [field]: value
    };
    document.data.setSchemaMetadata(schemaId, updatedMetadata);
  };

  const canMutateSchemas = db && providers.some(p => db.isSchemasEditable(p.id));

  return (
    <div className={styles.icSchemasTab}>
      <div className={styles.eHeader}>
        <p className={styles.eTitle}>Schemas</p>
        {providers.length > 0 && (
          <MenuButton.Root>
            <MenuButton.Trigger
              variant="primary"
              size={'md'}
              disabled={!canMutateSchemas}
              style={{ display: 'flex', gap: '0.25rem' }}
            >
              <TbPlus /> Add Schema
            </MenuButton.Trigger>
            <MenuButton.Menu>
              {providers.map(provider => (
                <Menu.Item
                  key={provider.id}
                  disabled={!db.isSchemasEditable(provider.id)}
                  onClick={() => setAddSchemaDialog({ open: true, providerId: provider.id })}
                >
                  {getProviderTypeName(provider.providerId)}: {provider.id}
                </Menu.Item>
              ))}
            </MenuButton.Menu>
          </MenuButton.Root>
        )}
      </div>

      {!canMutateSchemas && (
        <div className={styles.eMessage}>
          <p>The current data provider does not support schema management.</p>
          <p>Switch to a different provider (like REST API) to manage schemas.</p>
        </div>
      )}

      {providers.length > 0 && (
        <div className={styles.eToolbar}>
          <label className={styles.eFilter}>
            <span className={styles.eFilterLabel}>Provider</span>
            <select
              className={styles.eFilterSelect}
              value={selectedProviderId}
              onChange={e => setSelectedProviderId(e.target.value)}
            >
              <option value="all">All</option>
              {providers.map(provider => (
                <option key={provider.id} value={provider.id}>
                  {getProviderTypeName(provider.providerId)}: {provider.id}
                </option>
              ))}
            </select>
            <TbChevronDown size={10} />
          </label>
        </div>
      )}

      {schemas.length === 0 && canMutateSchemas && (
        <div className={styles.eEmpty}>
          {db.schemas.length === 0 ? (
            <div className={styles.eEmptyTitle}>No schemas defined yet</div>
          ) : (
            <>
              <div className={styles.eEmptyTitle}>No schemas found</div>
              <div>Try adjusting your filter.</div>
            </>
          )}
        </div>
      )}

      {schemas.length > 0 && (
        <div className={styles.eTableWrap}>
          <table className={styles.eTable}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th>Field Names</th>
                <th>Source</th>
                <th>Available for Element Data</th>
                <th>Use Document Overrides</th>
                {canMutateSchemas && <th style={{ width: 28 }} />}
              </tr>
            </thead>
            <tbody>
              {schemas.map(schema => {
                const metadata = document.data.getSchemaMetadata(schema.id);
                const isDefaultProvider = schema.providerId === 'default';
                const isEditable = canMutateSchemas && db.isSchemasEditable(schema.providerId);
                return (
                  <tr
                    key={schema.id}
                    onClick={
                      isEditable ? () => setEditSchemaDialog({ open: true, schema }) : undefined
                    }
                    style={isEditable ? { cursor: 'pointer' } : undefined}
                  >
                    <td>{schema.name}</td>
                    <td>{schema.description ?? '-'}</td>
                    <td>{getFieldNamesDisplay(schema)}</td>
                    <td>{schema.providerId}</td>
                    <td onClick={ev => ev.stopPropagation()}>
                      <Checkbox
                        value={metadata.availableForElementLocalData ?? false}
                        onChange={checked =>
                          handleMetadataChange(
                            schema.id,
                            'availableForElementLocalData',
                            checked ?? false
                          )
                        }
                      />
                    </td>
                    <td onClick={ev => ev.stopPropagation()}>
                      <Checkbox
                        value={metadata.useDocumentOverrides ?? false}
                        disabled={isDefaultProvider}
                        onChange={checked =>
                          handleMetadataChange(schema.id, 'useDocumentOverrides', checked ?? false)
                        }
                      />
                    </td>
                    {canMutateSchemas && (
                      <td onClick={ev => ev.stopPropagation()}>
                        {isEditable && (
                          <MenuButton.Root>
                            <MenuButton.Trigger
                              element={
                                <button type="button" className={styles.eDotsBtn}>
                                  <TbDots size={14} />
                                </button>
                              }
                            />
                            <MenuButton.Menu>
                              <Menu.Item
                                type="danger"
                                leftSlot={<TbTrash size={13} />}
                                onClick={() => handleDeleteSchema(schema)}
                              >
                                Delete
                              </Menu.Item>
                            </MenuButton.Menu>
                          </MenuButton.Root>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <EditSchemaDialog
        title="Add Schema"
        open={addSchemaDialog.open}
        onOk={(s: DataSchema) => handleAddSchema(addSchemaDialog.providerId!, s)}
        onCancel={() => setAddSchemaDialog({ open: false })}
        availableSchemas={schemas}
        document={document}
      />
      <EditSchemaDialog
        title="Edit Schema"
        open={editSchemaDialog.open}
        onOk={handleUpdateSchema}
        onCancel={() => setEditSchemaDialog({ open: false })}
        schema={editSchemaDialog.schema}
        availableSchemas={schemas}
        document={document}
      />
    </div>
  );
};
