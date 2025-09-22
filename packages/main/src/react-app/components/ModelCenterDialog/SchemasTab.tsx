import { useState, useEffect } from 'react';
import { useDocument } from '../../../application';
import { DataProvider, MutableSchemaProvider } from '@diagram-craft/model/dataProvider';
import { DataSchema } from '@diagram-craft/model/diagramDocumentDataSchemas';
import { Button } from '@diagram-craft/app-components/Button';
import { TbPlus, TbPencil, TbTrash } from 'react-icons/tb';
import { EditSchemaDialog } from '../EditSchemaDialog';
import { MessageDialogCommand } from '@diagram-craft/canvas/context';
import { useApplication } from '../../../application';

export const SchemasTab = () => {
  const document = useDocument();
  const application = useApplication();
  const [addSchemaDialog, setAddSchemaDialog] = useState<boolean>(false);
  const [editSchemaDialog, setEditSchemaDialog] = useState<{ open: boolean; schema?: DataSchema }>({
    open: false
  });
  const [schemas, setSchemas] = useState<DataSchema[]>([]);

  const dataProvider = document.data.provider;

  // Update schemas list when provider changes
  useEffect(() => {
    if (dataProvider?.schemas) {
      setSchemas([...dataProvider.schemas]);
    } else {
      setSchemas([]);
    }
  }, [dataProvider?.schemas]);

  // Helper function to check if provider supports schema mutations
  const isMutableSchemaProvider = (
    provider: DataProvider
  ): provider is DataProvider & MutableSchemaProvider => {
    return 'addSchema' in provider && 'updateSchema' in provider && 'deleteSchema' in provider;
  };

  // Handle schema operations
  const handleAddSchema = async (schema: DataSchema) => {
    if (!dataProvider || !isMutableSchemaProvider(dataProvider)) return;

    try {
      await dataProvider.addSchema(schema);
      setAddSchemaDialog(false);
      setSchemas([...dataProvider.schemas]);
    } catch (error) {
      console.error('Failed to add schema:', error);
    }
  };

  const handleUpdateSchema = async (schema: DataSchema) => {
    if (!dataProvider || !isMutableSchemaProvider(dataProvider)) return;

    try {
      await dataProvider.updateSchema(schema);
      setEditSchemaDialog({ open: false });
      setSchemas([...dataProvider.schemas]);
    } catch (error) {
      console.error('Failed to update schema:', error);
    }
  };

  const handleDeleteSchema = (schema: DataSchema) => {
    if (!dataProvider || !isMutableSchemaProvider(dataProvider)) return;

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
            await dataProvider.deleteSchema(schema);
            setSchemas([...dataProvider.schemas]);
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

  const canMutateSchemas = dataProvider && isMutableSchemaProvider(dataProvider);

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ margin: 0 }}>Schemas</p>
        {canMutateSchemas && (
          <Button type="primary" onClick={() => setAddSchemaDialog(true)}>
            <TbPlus /> Add Schema
          </Button>
        )}
      </div>

      {!dataProvider && (
        <div
          style={{
            padding: '2rem',
            textAlign: 'center',
            color: 'var(--base-fg-dim)',
            backgroundColor: 'var(--base-bg-dim)',
            borderRadius: '6px'
          }}
        >
          <p>No data provider configured</p>
          <p>Configure a data provider in the Model Providers tab to manage schemas.</p>
        </div>
      )}

      {dataProvider && !canMutateSchemas && (
        <div
          style={{
            padding: '1rem',
            backgroundColor: 'var(--base-bg-dim)',
            borderRadius: '6px',
            color: 'var(--base-fg-dim)'
          }}
        >
          <p>The current data provider does not support schema management.</p>
          <p>Switch to a different provider (like REST API) to manage schemas.</p>
        </div>
      )}

      {schemas.length === 0 && canMutateSchemas && (
        <div
          style={{
            padding: '2rem',
            textAlign: 'center',
            backgroundColor: 'var(--base-bg-dim)',
            borderRadius: '6px'
          }}
        >
          <p>No schemas defined yet</p>
          <Button type="primary" onClick={() => setAddSchemaDialog(true)}>
            <TbPlus /> Create Your First Schema
          </Button>
        </div>
      )}

      {schemas.length > 0 && (
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse'
          }}
        >
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
                <td>{schema.source}</td>
                {canMutateSchemas && (
                  <td>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <Button
                        type="icon-only"
                        onClick={() => setEditSchemaDialog({ open: true, schema })}
                        title="Edit schema"
                      >
                        <TbPencil />
                      </Button>
                      <Button
                        type="icon-only"
                        onClick={() => handleDeleteSchema(schema)}
                        title="Delete schema"
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
        open={addSchemaDialog}
        onOk={handleAddSchema}
        onCancel={() => setAddSchemaDialog(false)}
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
