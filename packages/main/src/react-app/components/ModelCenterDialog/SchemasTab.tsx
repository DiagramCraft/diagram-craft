import { useState } from 'react';
import { useApplication, useDocument } from '../../../application';
import { DataSchema } from '@diagram-craft/model/diagramDocumentDataSchemas';
import { Button } from '@diagram-craft/app-components/Button';
import { Select } from '@diagram-craft/app-components/Select';
import { TbPencil, TbPlus, TbTrash } from 'react-icons/tb';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { EditSchemaDialog } from '../EditSchemaDialog';
import { MessageDialogCommand } from '@diagram-craft/canvas/context';
import styles from './SchemasTab.module.css';

export const SchemasTab = () => {
  const document = useDocument();
  const application = useApplication();
  const [addSchemaDialog, setAddSchemaDialog] = useState<{ open: boolean; providerId?: string }>({
    open: false
  });
  const [editSchemaDialog, setEditSchemaDialog] = useState<{ open: boolean; schema?: DataSchema }>({
    open: false
  });
  const [selectedProviderId, setSelectedProviderId] = useState<string>('all');

  const db = document.data.db;
  const allSchemas = db?.schemas ?? [];
  const providers = document.data.providers;

  // Filter schemas by selected provider
  const schemas =
    selectedProviderId === 'all'
      ? allSchemas
      : allSchemas.filter(schema => schema.providerId === selectedProviderId);

  // Handle schema operations
  const handleAddSchema = async (providerId: string, schema: DataSchema) => {
    if (!db || !db.isSchemasEditable(providerId)) return;

    try {
      await db.addSchema(schema, providerId);
      setAddSchemaDialog({ open: false });
    } catch (error) {
      console.error('Failed to add schema:', error);
    }
  };

  const handleUpdateSchema = async (schema: DataSchema) => {
    if (!db || !db.isSchemasEditable(schema.providerId)) return;

    try {
      await db.updateSchema(schema);
      setEditSchemaDialog({ open: false });
    } catch (error) {
      console.error('Failed to update schema:', error);
    }
  };

  const handleDeleteSchema = (schema: DataSchema) => {
    if (!db || !db.isSchemasEditable(schema.providerId)) return;

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
            await db.deleteSchema(schema);
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

  const canMutateSchemas = db && providers.some(p => db.isSchemasEditable(p.id));

  return (
    <>
      <div className={styles.schemasTabHeader}>
        <p className={styles.schemasTabTitle}>Schemas</p>
        {providers.length > 0 && (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button
                type="secondary"
                disabled={!canMutateSchemas}
                style={{ display: 'flex', gap: '0.25rem' }}
              >
                <TbPlus /> Add Schema
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content className="cmp-context-menu" sideOffset={5}>
                {providers.map(provider => (
                  <DropdownMenu.Item
                    key={provider.id}
                    className="cmp-context-menu__item"
                    disabled={!db.isSchemasEditable(provider.id)}
                    onSelect={() => setAddSchemaDialog({ open: true, providerId: provider.id })}
                  >
                    {getProviderTypeName(provider.providerId)}: {provider.id}
                  </DropdownMenu.Item>
                ))}
                <DropdownMenu.Arrow className="cmp-context-menu__arrow" />
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        )}
      </div>

      {!db && (
        <div className={styles.schemasTabMessageBox}>
          <p>No data provider configured</p>
          <p>Configure a data provider in the Model Providers tab to manage schemas.</p>
        </div>
      )}

      {db && !canMutateSchemas && (
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
          {allSchemas.length === 0 ? (
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
              {canMutateSchemas && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {schemas.map(schema => (
              <tr key={schema.id}>
                <td>{schema.name}</td>
                <td>{getFieldNamesDisplay(schema)}</td>
                <td>{schema.providerId}</td>
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
            ))}
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
      />
      <EditSchemaDialog
        title="Edit Schema"
        open={editSchemaDialog.open}
        onOk={handleUpdateSchema}
        onCancel={() => setEditSchemaDialog({ open: false })}
        schema={editSchemaDialog.schema}
        availableSchemas={schemas}
      />
    </>
  );
};
