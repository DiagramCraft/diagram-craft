import { useState, useEffect, useRef } from 'react';
import { useDocument, useApplication } from '../../../application';
import { DataProvider, MutableDataProvider, Data } from '@diagram-craft/model/dataProvider';
import { DataSchema } from '@diagram-craft/model/diagramDocumentDataSchemas';
import { Button } from '@diagram-craft/app-components/Button';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { Select } from '@diagram-craft/app-components/Select';
import { TbPlus, TbPencil, TbTrash, TbSearch, TbChevronDown } from 'react-icons/tb';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { EditItemDialog } from '../EditItemDialog';
import { MessageDialogCommand } from '@diagram-craft/canvas/context';
import styles from './DataTab.module.css';

type DataItemWithSchema = Data & {
  _schema: DataSchema;
};

// Helper function to check if provider supports data mutations
const isMutableDataProvider = (
  provider: DataProvider
): provider is DataProvider & MutableDataProvider => {
  return 'addData' in provider && 'updateData' in provider && 'deleteData' in provider;
};

const filterItems = (items: DataItemWithSchema[], schemaId: string, searchQuery: string) => {
  let filtered = items;

  if (schemaId !== 'all') {
    filtered = filtered.filter(item => item._schema.id === schemaId);
  }

  if (searchQuery.trim() !== '') {
    filtered = filtered.filter(item => {
      return item._schema.fields.some(field => {
        const value = item[field.id];
        return value && value.toLowerCase().includes(searchQuery.toLowerCase());
      });
    });
  }

  return filtered;
};

export const DataTab = () => {
  const document = useDocument();
  const application = useApplication();
  const searchRef = useRef<HTMLInputElement>(null);

  const [allDataItems, setAllDataItems] = useState<DataItemWithSchema[]>([]);
  const [filteredDataItems, setFilteredDataItems] = useState<DataItemWithSchema[]>([]);
  const [selectedSchemaId, setSelectedSchemaId] = useState<string>('all');
  const [searchText, setSearchText] = useState<string>('');
  const [addItemDialog, setAddItemDialog] = useState<{ open: boolean; schemaId?: string }>({
    open: false
  });
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
      return;
    }

    const allItems: DataItemWithSchema[] = [];

    for (const schema of dataProvider.schemas) {
      const schemaData = dataProvider.getData(schema);
      const itemsWithSchema = schemaData.map(
        item => ({ ...item, _schema: schema }) as DataItemWithSchema
      );
      allItems.push(...itemsWithSchema);
    }

    setAllDataItems(allItems);
  }, [dataProvider?.schemas]);

  useEffect(() => {
    if (!dataProvider) return;

    const handleDataChange = () => {
      if (!dataProvider.schemas) return;

      const allItems: DataItemWithSchema[] = [];
      for (const schema of dataProvider.schemas) {
        const schemaData = dataProvider.getData(schema);
        const itemsWithSchema = schemaData.map(
          item => ({ ...item, _schema: schema }) as DataItemWithSchema
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

  useEffect(() => {
    const filtered = filterItems(allDataItems, selectedSchemaId, '');
    setFilteredDataItems(filtered);
  }, [allDataItems, selectedSchemaId]);

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
    const filtered = filterItems(allDataItems, selectedSchemaId, searchText);
    setFilteredDataItems(filtered);
    searchRef.current?.blur();
  };

  const getDisplayValue = (
    item: DataItemWithSchema,
    field: { id: string; name: string }
  ): string => {
    const value = item[field.id];
    if (!value) return '-';
    if (value.length > 50) return value.substring(0, 50) + '...';
    return value;
  };

  const canMutateData = dataProvider && isMutableDataProvider(dataProvider);
  const hasSchemas = dataProvider?.schemas && dataProvider.schemas.length > 0;

  return (
    <>
      <div className={styles.dataTabHeader}>
        <p className={styles.dataTabTitle}>Data</p>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <Button
              type="secondary"
              className={styles.dataTabAddButton}
              disabled={!(canMutateData && hasSchemas)}
            >
              <TbPlus /> Add Data
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className="cmp-context-menu" sideOffset={5}>
              {dataProvider?.schemas?.map(schema => (
                <DropdownMenu.Item
                  key={schema.id}
                  className="cmp-context-menu__item"
                  onSelect={() => setAddItemDialog({ open: true, schemaId: schema.id })}
                >
                  {schema.name}
                </DropdownMenu.Item>
              ))}
              <DropdownMenu.Arrow className="cmp-context-menu__arrow" />
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      {!dataProvider && (
        <div className={`${styles.dataTabMessageBox}`}>
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
        <div className={`${styles.dataTabMessageBox}`}>
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
                      const filtered = filterItems(allDataItems, selectedSchemaId, '');
                      setFilteredDataItems(filtered);
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
                      <DropdownMenu.Root>
                        <DropdownMenu.Trigger asChild>
                          <Button type="primary">
                            <TbPlus /> Add Your First Data Item <TbChevronDown />
                          </Button>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Portal>
                          <DropdownMenu.Content className="cmp-context-menu" sideOffset={5}>
                            {dataProvider?.schemas?.map(schema => (
                              <DropdownMenu.Item
                                key={schema.id}
                                className="cmp-context-menu__item"
                                onSelect={() =>
                                  setAddItemDialog({ open: true, schemaId: schema.id })
                                }
                              >
                                {schema.name}
                              </DropdownMenu.Item>
                            ))}
                            <DropdownMenu.Arrow className="cmp-context-menu__arrow" />
                          </DropdownMenu.Content>
                        </DropdownMenu.Portal>
                      </DropdownMenu.Root>
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
        open={addItemDialog.open}
        onClose={() => setAddItemDialog({ open: false })}
        dataProvider={dataProvider}
        selectedSchema={addItemDialog.schemaId}
      />
      <EditItemDialog
        open={editItemDialog.open}
        onClose={() => setEditItemDialog({ open: false })}
        dataProvider={dataProvider}
        selectedSchema={editItemDialog.schema?.id}
        editItem={editItemDialog.item}
      />
    </>
  );
};
