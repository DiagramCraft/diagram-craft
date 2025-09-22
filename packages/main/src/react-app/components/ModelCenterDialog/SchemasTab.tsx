import { useEffect, useState } from 'react';
import { useApplication, useDocument } from '../../../application';
import { DataSchema } from '@diagram-craft/model/diagramDocumentDataSchemas';
import { Button } from '@diagram-craft/app-components/Button';
import { TbPencil, TbPlus, TbTrash } from 'react-icons/tb';
import { EditSchemaDialog } from '../EditSchemaDialog';
import { MessageDialogCommand } from '@diagram-craft/canvas/context';
import styles from './SchemasTab.module.css';

export const SchemasTab = () => {
  const document = useDocument();
  const application = useApplication();
  const [addSchemaDialog, setAddSchemaDialog] = useState<boolean>(false);
  const [editSchemaDialog, setEditSchemaDialog] = useState<{ open: boolean; schema?: DataSchema }>({
    open: false
  });
  const [schemas, setSchemas] = useState<DataSchema[]>([]);

  const dataProvider = document.data.manager;

  // Update schemas list when provider changes
  useEffect(() => {
    if (dataProvider?.schemas) {
      setSchemas([...dataProvider.schemas]);
    } else {
      setSchemas([]);
    }
  }, [dataProvider?.schemas]);

  // Handle schema operations
  const handleAddSchema = async (schema: DataSchema) => {
    if (!dataProvider || !dataProvider.isMutableSchema()) return;

    try {
      await dataProvider.addSchema(schema);
      setAddSchemaDialog(false);
      setSchemas([...dataProvider.schemas]);
    } catch (error) {
      console.error('Failed to add schema:', error);
    }
  };

  const handleUpdateSchema = async (schema: DataSchema) => {
    if (!dataProvider || !dataProvider.isMutableSchema()) return;

    try {
      await dataProvider.updateSchema(schema);
      setEditSchemaDialog({ open: false });
      setSchemas([...dataProvider.schemas]);
    } catch (error) {
      console.error('Failed to update schema:', error);
    }
  };

  const handleDeleteSchema = (schema: DataSchema) => {
    if (!dataProvider || !dataProvider.isMutableSchema()) return;

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

  const canMutateSchemas = dataProvider && dataProvider.isMutableSchema();

  return (
    <>
      <div className={styles.schemasTabHeader}>
        <p className={styles.schemasTabTitle}>Schemas</p>
        <Button
          type="secondary"
          onClick={() => setAddSchemaDialog(true)}
          disabled={!canMutateSchemas}
        >
          <TbPlus /> Add Schema
        </Button>
      </div>

      {!dataProvider && (
        <div className={styles.schemasTabMessageBox}>
          <p>No data provider configured</p>
          <p>Configure a data provider in the Model Providers tab to manage schemas.</p>
        </div>
      )}

      {dataProvider && !canMutateSchemas && (
        <div className={styles.schemasTabMessageBox}>
          <p>The current data provider does not support schema management.</p>
          <p>Switch to a different provider (like REST API) to manage schemas.</p>
        </div>
      )}

      {schemas.length === 0 && canMutateSchemas && (
        <div className={styles.schemasTabMessageBox}>
          <p>No schemas defined yet</p>
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
