import { useState, useEffect, useRef } from 'react';
import { useDocument, useApplication } from '../../../application';
import { DataProvider, MutableDataProvider, Data } from '@diagram-craft/model/dataProvider';
import { DataSchema } from '@diagram-craft/model/diagramDocumentDataSchemas';
import { Button } from '@diagram-craft/app-components/Button';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { Select } from '@diagram-craft/app-components/Select';
import { TbPlus, TbPencil, TbTrash, TbSearch } from 'react-icons/tb';
import { EditItemDialog } from '../EditItemDialog';
import { MessageDialogCommand } from '@diagram-craft/canvas/context';
import styles from './DataTab.module.css';

type DataItemWithSchema = Data & {
  _schema: DataSchema;
};

export const DataTab = () => {
  const document = useDocument();
  const application = useApplication();
  const searchRef = useRef<HTMLInputElement>(null);

  const [allDataItems, setAllDataItems] = useState<DataItemWithSchema[]>([]);
  const [filteredDataItems, setFilteredDataItems] = useState<DataItemWithSchema[]>([]);
  const [selectedSchemaId, setSelectedSchemaId] = useState<string>('all');
  const [searchText, setSearchText] = useState<string>('');
  const [addItemDialog, setAddItemDialog] = useState<boolean>(false);
  const [selectedAddSchema, setSelectedAddSchema] = useState<string>('');
  const [editItemDialog, setEditItemDialog] = useState<{
    open: boolean;
    item?: Data;
    schema?: DataSchema;
  }>({
    open: false
  });

  const dataProvider = document.data.provider;

  // Collect all data items from all schemas
  useEffect(() => {
    if (!dataProvider?.schemas) {
      setAllDataItems([]);
      setSelectedAddSchema('');
      return;
    }

    const allItems: DataItemWithSchema[] = [];

    for (const schema of dataProvider.schemas) {
      const schemaData = dataProvider.getData(schema);
      const itemsWithSchema = schemaData.map(
        item =>
          ({
            ...item,
            _schema: schema
          }) as DataItemWithSchema
      );
      allItems.push(...itemsWithSchema);
    }

    setAllDataItems(allItems);

    // Set default schema for add dialog
    if (dataProvider.schemas.length > 0 && !selectedAddSchema) {
      setSelectedAddSchema(dataProvider.schemas[0].id);
    }
  }, [dataProvider?.schemas, selectedAddSchema]);

  // Update data when provider changes
  useEffect(() => {
    if (!dataProvider) return;

    const handleDataChange = () => {
      if (!dataProvider.schemas) return;

      const allItems: DataItemWithSchema[] = [];
      for (const schema of dataProvider.schemas) {
        const schemaData = dataProvider.getData(schema);
        const itemsWithSchema = schemaData.map(
          item =>
            ({
              ...item,
              _schema: schema
            }) as DataItemWithSchema
        );
        allItems.push(...itemsWithSchema);
      }
      setAllDataItems(allItems);
    };

    dataProvider.on('addData', handleDataChange);
    dataProvider.on('updateData', handleDataChange);
    dataProvider.on('deleteData', handleDataChange);

    return () => {
      dataProvider.off('addData', handleDataChange);
      dataProvider.off('updateData', handleDataChange);
      dataProvider.off('deleteData', handleDataChange);
    };
  }, [dataProvider]);

  // Filter and search data items
  useEffect(() => {
    let filtered = allDataItems;

    // Filter by schema
    if (selectedSchemaId !== 'all') {
      filtered = filtered.filter(item => item._schema.id === selectedSchemaId);
    }

    // Filter by search text
    if (searchText.trim() !== '') {
      filtered = filtered.filter(item => {
        // Search across all field values
        return item._schema.fields.some(field => {
          const value = item[field.id];
          return value && value.toLowerCase().includes(searchText.toLowerCase());
        });
      });
    }

    setFilteredDataItems(filtered);
  }, [allDataItems, selectedSchemaId, searchText]);

  // Helper function to check if provider supports data mutations
  const isMutableDataProvider = (
    provider: DataProvider
  ): provider is DataProvider & MutableDataProvider => {
    return 'addData' in provider && 'updateData' in provider && 'deleteData' in provider;
  };

  // Handle data operations
  const handleDeleteItem = (item: DataItemWithSchema) => {
    if (!dataProvider || !isMutableDataProvider(dataProvider)) return;

    const displayValue = item._schema.fields[0] ? item[item._schema.fields[0].id] : item._uid;
    const itemName = displayValue || 'this item';

    application.ui.showDialog(
      new MessageDialogCommand(
        {
          title: 'Delete Item',
          message: `Are you sure you want to delete "${itemName}" from schema "${item._schema.name}"?`,
          okLabel: 'Delete',
          okType: 'danger',
          cancelLabel: 'Cancel'
        },
        async () => {
          try {
            await dataProvider.deleteData(item._schema, item);
          } catch (error) {
            console.error('Failed to delete item:', error);
          }
        }
      )
    );
  };

  const handleSearch = () => {
    // Search is handled by the useEffect above
    searchRef.current?.blur();
  };

  const getDisplayValue = (
    item: DataItemWithSchema,
    field: { id: string; name: string }
  ): string => {
    const value = item[field.id];
    if (!value) return '-';
    if (typeof value === 'string' && value.length > 50) {
      return value.substring(0, 50) + '...';
    }
    return value;
  };

  const canMutateData = dataProvider && isMutableDataProvider(dataProvider);
  const hasSchemas = dataProvider?.schemas && dataProvider.schemas.length > 0;

  return (
    <div className={styles.dataTab}>
      <div className={styles.dataTabHeader}>
        <p className={styles.dataTabTitle}>Data</p>
        {canMutateData && hasSchemas && (
          <div className={styles.dataTabAddControls}>
            <Select.Root value={selectedAddSchema} onChange={v => setSelectedAddSchema(v ?? '')}>
              {dataProvider?.schemas?.map(schema => (
                <Select.Item key={schema.id} value={schema.id}>
                  {schema.name}
                </Select.Item>
              ))}
            </Select.Root>
            <Button
              type="primary"
              onClick={() => setAddItemDialog(true)}
              disabled={!selectedAddSchema}
              className={styles.dataTabAddButton}
            >
              <TbPlus /> Add Data
            </Button>
          </div>
        )}
      </div>

      {!dataProvider && (
        <div className={`${styles.dataTabMessageBox} ${styles.dataTabMessageBoxNoProvider}`}>
          <p>No data provider configured</p>
          <p>Configure a data provider in the Model Providers tab to manage data.</p>
        </div>
      )}

      {dataProvider && !hasSchemas && (
        <div className={styles.dataTabMessageBox}>
          <p>No schemas available</p>
          <p>Create schemas in the Schemas tab before adding data.</p>
        </div>
      )}

      {dataProvider && !canMutateData && (
        <div className={`${styles.dataTabMessageBox} ${styles.dataTabMessageBoxNoMutation}`}>
          <p>The current data provider does not support data management.</p>
          <p>Switch to a different provider (like REST API) to manage data.</p>
        </div>
      )}

      {hasSchemas && (
        <>
          {/* Search and Filter Controls */}
          <div className={styles.dataTabSearchControls}>
            <div className={styles.dataTabFilterGroup}>
              <label className={styles.dataTabFilterLabel}>Filter by Schema:</label>
              <Select.Root value={selectedSchemaId} onChange={v => setSelectedSchemaId(v ?? 'all')}>
                <Select.Item value="all">All Schemas ({allDataItems.length} items)</Select.Item>
                {dataProvider?.schemas?.map(schema => {
                  const count = allDataItems.filter(item => item._schema.id === schema.id).length;
                  return (
                    <Select.Item key={schema.id} value={schema.id}>
                      {schema.name} ({count} items)
                    </Select.Item>
                  );
                })}
              </Select.Root>
            </div>

            <div className={styles.dataTabSearchGroup}>
              <label className={styles.dataTabFilterLabel}>Search:</label>
              <div className={styles.dataTabSearchInputGroup}>
                <TextInput
                  ref={searchRef}
                  value={searchText}
                  onChange={v => setSearchText(v ?? '')}
                  placeholder="Search across all fields..."
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      handleSearch();
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      e.stopPropagation();
                      setSearchText('');
                      searchRef.current?.blur();
                    }
                  }}
                  className={styles.dataTabSearchInput}
                />
                <Button type="secondary" onClick={handleSearch}>
                  <TbSearch />
                </Button>
              </div>
            </div>
          </div>

          {/* Data Results */}
          {filteredDataItems.length === 0 && (
            <div className={styles.dataTabEmptyState}>
              {allDataItems.length === 0 ? (
                <>
                  <p>No data items yet</p>
                  {canMutateData && (
                    <div className={styles.dataTabEmptyStateControls}>
                      <div className={styles.dataTabEmptyStateAddControls}>
                        <div className={styles.dataTabEmptyStateSchemaGroup}>
                          <label className={styles.dataTabEmptyStateSchemaLabel}>
                            Add to schema:
                          </label>
                          <Select.Root
                            value={selectedAddSchema}
                            onChange={v => setSelectedAddSchema(v ?? '')}
                          >
                            {dataProvider?.schemas?.map(schema => (
                              <Select.Item key={schema.id} value={schema.id}>
                                {schema.name}
                              </Select.Item>
                            ))}
                          </Select.Root>
                        </div>
                        <Button
                          type="primary"
                          onClick={() => setAddItemDialog(true)}
                          disabled={!selectedAddSchema}
                        >
                          <TbPlus /> Add Your First Data Item
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p>No items match your current filters</p>
              )}
            </div>
          )}

          {filteredDataItems.length > 0 && (
            <table className={styles.dataTabTable}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>ID</th>
                  <th>Schema</th>
                  <th>Fields</th>
                  {canMutateData && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filteredDataItems.map(item => {
                  const primaryField = item._schema.fields[0];
                  const displayFields = item._schema.fields.slice(1, 3); // Show up to 2 additional fields

                  return (
                    <tr key={item._uid}>
                      <td>{primaryField ? getDisplayValue(item, primaryField) : '-'}</td>
                      <td>{item._uid.substring(0, 8)}</td>
                      <td>{item._schema.name}</td>
                      <td>
                        {displayFields.length > 0
                          ? displayFields
                              .map(field => `${field.name}: ${getDisplayValue(item, field)}`)
                              .join(', ')
                          : '-'}
                      </td>
                      {canMutateData && (
                        <td>
                          <div className={styles.dataTabTableActions}>
                            <Button
                              type="icon-only"
                              onClick={() =>
                                setEditItemDialog({ open: true, item, schema: item._schema })
                              }
                              title="Edit item"
                            >
                              <TbPencil />
                            </Button>
                            <Button
                              type="icon-only"
                              onClick={() => handleDeleteItem(item)}
                              title="Delete item"
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
        </>
      )}

      {/* Data Management Dialogs */}
      <EditItemDialog
        open={addItemDialog}
        onClose={() => setAddItemDialog(false)}
        dataProvider={dataProvider}
        selectedSchema={selectedAddSchema}
      />
      <EditItemDialog
        open={editItemDialog.open}
        onClose={() => setEditItemDialog({ open: false })}
        dataProvider={dataProvider}
        selectedSchema={editItemDialog.schema?.id}
        editItem={editItemDialog.item}
      />
    </div>
  );
};
