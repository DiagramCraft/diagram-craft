import { useEffect, useState } from 'react';
import { useApplication, useDiagram, useDocument } from '../../../application';
import { DataSchema, SchemaMetadata } from '@diagram-craft/model/diagramDocumentDataSchemas';
import { Button } from '@diagram-craft/app-components/Button';
import { Select } from '@diagram-craft/app-components/Select';
import { Checkbox } from '@diagram-craft/app-components/Checkbox';
import { TbPencil, TbPlus, TbTrash } from 'react-icons/tb';
import { EditSchemaDialog } from '../EditSchemaDialog';
import { MessageDialogCommand } from '@diagram-craft/canvas/context';
import { useRedraw } from '../../hooks/useRedraw';
import styles from './SchemasTab.module.css';
import { DataManagerUndoableFacade } from '@diagram-craft/model/diagramDocumentDataUndoActions';
import { Menu as BaseUIMenu } from '@base-ui-components/react/menu';

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
  const dbUndoable = new DataManagerUndoableFacade(diagram.undoManager, db);

  const providers = document.data.providers;

  // Listen for schema updates to re-render when metadata changes
  useEffect(() => {
    document.data._schemas.on('update', redraw);
    return () => document.data._schemas.off('update', redraw);
  }, [document, redraw]);

  // Filter schemas by selected provider
  const schemas =
    selectedProviderId === 'all'
      ? db.schemas
      : db.schemas.filter(schema => schema.providerId === selectedProviderId);

  // Handle schema operations
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
    <>
      <div className={styles.schemasTabHeader}>
        <p className={styles.schemasTabTitle}>Schemas</p>
        {providers.length > 0 && (
          <BaseUIMenu.Root>
            <BaseUIMenu.Trigger
              render={
                <Button
                  type="secondary"
                  disabled={!canMutateSchemas}
                  style={{ display: 'flex', gap: '0.25rem' }}
                >
                  <TbPlus /> Add Schema
                </Button>
              }
            />
            <BaseUIMenu.Portal>
              <BaseUIMenu.Positioner sideOffset={5}>
                <BaseUIMenu.Popup className="cmp-context-menu">
                  {providers.map(provider => (
                    <BaseUIMenu.Item
                      key={provider.id}
                      className="cmp-context-menu__item"
                      disabled={!db.isSchemasEditable(provider.id)}
                      onSelect={() => setAddSchemaDialog({ open: true, providerId: provider.id })}
                    >
                      {getProviderTypeName(provider.providerId)}: {provider.id}
                    </BaseUIMenu.Item>
                  ))}
                  <BaseUIMenu.Arrow className="cmp-context-menu__arrow" />
                </BaseUIMenu.Popup>
              </BaseUIMenu.Positioner>
            </BaseUIMenu.Portal>
          </BaseUIMenu.Root>
        )}
      </div>

      {!canMutateSchemas && (
        <div className={styles.schemasTabMessageBox}>
          <p>The current data provider does not support schema management.</p>
          <p>Switch to a different provider (like REST API) to manage schemas.</p>
        </div>
      )}

      {providers.length > 0 && (
        <div className={styles.schemasTabFilterControls}>
          <div className={styles.schemasTabFilterGroup}>
            <label className={styles.schemasTabFilterLabel}>Filter by Provider:</label>
            <Select.Root
              value={selectedProviderId}
              onChange={v => setSelectedProviderId(v ?? 'all')}
              style={{ maxWidth: '20rem' }}
            >
              <Select.Item value="all">All Providers</Select.Item>
              {providers.map(provider => (
                <Select.Item key={provider.id} value={provider.id}>
                  {getProviderTypeName(provider.providerId)}: {provider.id}
                </Select.Item>
              ))}
            </Select.Root>
          </div>
        </div>
      )}

      {schemas.length === 0 && canMutateSchemas && (
        <div className={styles.schemasTabMessageBox}>
          {db.schemas.length === 0 ? (
            <p>No schemas defined yet</p>
          ) : (
            <p>No schemas match your current filter</p>
          )}
        </div>
      )}

      {schemas.length > 0 && (
        <table className={styles.schemasTabTable}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Field Names</th>
              <th>Source</th>
              <th>Available for Element Data</th>
              <th>Use Document Overrides</th>
              {canMutateSchemas && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {schemas.map(schema => {
              const metadata = document.data.getSchemaMetadata(schema.id);
              const isDefaultProvider = schema.providerId === 'default';
              return (
                <tr key={schema.id}>
                  <td>{schema.name}</td>
                  <td>{getFieldNamesDisplay(schema)}</td>
                  <td>{schema.providerId}</td>
                  <td>
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
                  <td>
                    <Checkbox
                      value={metadata.useDocumentOverrides ?? false}
                      disabled={isDefaultProvider}
                      onChange={checked =>
                        handleMetadataChange(schema.id, 'useDocumentOverrides', checked ?? false)
                      }
                    />
                  </td>
                  {canMutateSchemas && (
                    <td>
                      <div className={styles.schemasTabTableActions}>
                        <Button
                          type="icon-only"
                          onClick={() => setEditSchemaDialog({ open: true, schema })}
                          title="Edit schema"
                          disabled={!db.isSchemasEditable(schema.providerId)}
                        >
                          <TbPencil />
                        </Button>
                        <Button
                          type="icon-only"
                          onClick={() => handleDeleteSchema(schema)}
                          title="Delete schema"
                          disabled={!db.isSchemasEditable(schema.providerId)}
                        >
                          <TbTrash />
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* Schema Management Dialogs */}
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
    </>
  );
};
