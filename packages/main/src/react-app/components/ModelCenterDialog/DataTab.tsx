import { useEffect, useRef, useState } from 'react';
import { useApplication, useDocument } from '../../../application';
import { Data } from '@diagram-craft/model/dataProvider';
import { DataSchema } from '@diagram-craft/model/diagramDocumentDataSchemas';
import { Button } from '@diagram-craft/app-components/Button';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { Select } from '@diagram-craft/app-components/Select';
import { TbPencil, TbPlus, TbSearch, TbTrash } from 'react-icons/tb';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { EditItemDialog } from '../EditItemDialog';
import { MessageDialogCommand } from '@diagram-craft/canvas/context';
import styles from './DataTab.module.css';
import type { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import { asyncExecuteWithErrorDialog } from '../../ErrorBoundary';
import { shorten } from '@diagram-craft/utils/strings';

type DataItemWithSchema = Data & {
  _schema: DataSchema;
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
        return value?.toLowerCase().includes(searchQuery.toLowerCase());
      });
    });
  }

  return filtered;
};

const getOverrideStatus = (
  document: DiagramDocument,
  item: DataItemWithSchema
): { text: string; status: string } => {
  const db = document.data.db;

  const schemaMetadata = document.data.getSchemaMetadata(item._schema.id);

  if (!schemaMetadata.useDocumentOverrides) {
    return { text: 'N/A', status: 'na' };
  }

  const result = db.getOverrideStatusForItem(item._schema.id, item._uid);

  switch (result.status) {
    case 'unmodified':
      return { text: 'No', status: 'unmodified' };
    case 'modified-error':
      return {
        text: `Error (${result.override!.type})`,
        status: 'error'
      };
    case 'modified':
      return {
        text: `Yes (${result.override!.type})`,
        status: 'modified'
      };
  }
};

export const DataTab = () => {
  const document = useDocument();
  const application = useApplication();
  const searchRef = useRef<HTMLInputElement>(null);

  const [allDataItems, setAllDataItems] = useState<DataItemWithSchema[]>([]);
  const [filteredDataItems, setFilteredDataItems] = useState<DataItemWithSchema[]>([]);
  const [selectedSchemaId, setSelectedSchemaId] = useState<string>('all');
  const [searchText, setSearchText] = useState<string>('');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
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

  const db = document.data.db;

  // Collect all data items from all schemas
  useEffect(() => {
    const allItems: DataItemWithSchema[] = [];

    for (const schema of db.schemas) {
      const schemaData = db.getData(schema);
      const itemsWithSchema = schemaData.map(
        item => ({ ...item, _schema: schema }) as DataItemWithSchema
      );
      allItems.push(...itemsWithSchema);
    }

    setAllDataItems(allItems);
  }, [db]);

  useEffect(() => {
    const handleDataChange = () => {
      const allItems: DataItemWithSchema[] = [];
      for (const schema of db.schemas) {
        const schemaData = db.getData(schema);
        const itemsWithSchema = schemaData.map(
          item => ({ ...item, _schema: schema }) as DataItemWithSchema
        );
        allItems.push(...itemsWithSchema);
      }
      setAllDataItems(allItems);
    };

    db.on('addData', handleDataChange);
    db.on('updateData', handleDataChange);
    db.on('deleteData', handleDataChange);

    return () => {
      db.off('addData', handleDataChange);
      db.off('updateData', handleDataChange);
      db.off('deleteData', handleDataChange);
    };
  }, [db]);

  useEffect(() => {
    const filtered = filterItems(allDataItems, selectedSchemaId, '');
    setFilteredDataItems(filtered);
  }, [allDataItems, selectedSchemaId]);

  const handleDeleteItem = (item: DataItemWithSchema) => {
    const displayValue = item._schema.fields[0] ? item[item._schema.fields[0].id] : item._uid;
    const itemName = displayValue ?? 'this item';

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
          await db.deleteData(item._schema, item);
        }
      )
    );
  };

  const handleToggleSelection = (uid: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(uid)) {
        newSet.delete(uid);
      } else {
        newSet.add(uid);
      }
      return newSet;
    });
  };

  const handleToggleSelectAll = () => {
    if (selectedItems.size === filteredDataItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredDataItems.map(item => item._uid)));
    }
  };

  const handleApplySelectedOverrides = async () => {
    const itemsToApply = filteredDataItems.filter(item => selectedItems.has(item._uid));

    if (itemsToApply.length === 0) return;

    const targets = itemsToApply.map(item => ({
      schemaId: item._schema.id,
      uid: item._uid
    }));

    application.ui.showDialog(
      new MessageDialogCommand(
        {
          title: 'Apply Overrides',
          message: `Apply ${itemsToApply.length} override(s) to the data provider?`,
          okLabel: 'Apply',
          cancelLabel: 'Cancel'
        },
        async () => {
          await asyncExecuteWithErrorDialog({ application }, async () => {
            await db.applyOverrides(targets);
            setSelectedItems(new Set());
          });
        }
      )
    );
  };

  const handleClearSelectedOverrides = () => {
    const itemsToClear = filteredDataItems.filter(item => selectedItems.has(item._uid));

    if (itemsToClear.length === 0) return;

    application.ui.showDialog(
      new MessageDialogCommand(
        {
          title: 'Clear Overrides',
          message: `Clear ${itemsToClear.length} override(s)? This will discard the local changes.`,
          okLabel: 'Clear',
          okType: 'danger',
          cancelLabel: 'Cancel'
        },
        () => {
          for (const item of itemsToClear) {
            db.clearOverride(item._schema.id, item._uid);
          }
          setSelectedItems(new Set());
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
    if (value.length > 50) return `${value.substring(0, 50)}...`;
    return value;
  };

  const canMutateData = db.schemas.some(s => db.isDataEditable(s));
  const hasSchemas = db.schemas.length > 0;

  // Check if all selected items have overrides
  const selectedItemsWithOverrides = filteredDataItems.filter(item => {
    if (!selectedItems.has(item._uid)) return false;
    const status = getOverrideStatus(document, item);
    return status.status === 'modified' || status.status === 'error';
  });
  const allSelectedHaveOverrides =
    selectedItems.size > 0 && selectedItemsWithOverrides.length === selectedItems.size;

  return (
    <>
      <div className={styles.dataTabHeader}>
        <p className={styles.dataTabTitle}>Data</p>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <Button
            type="secondary"
            onClick={handleApplySelectedOverrides}
            disabled={!allSelectedHaveOverrides}
            style={{ display: 'flex', gap: '0.25rem' }}
          >
            Apply Overrides
          </Button>
          <Button
            type="danger"
            onClick={handleClearSelectedOverrides}
            disabled={!allSelectedHaveOverrides}
            style={{ display: 'flex', gap: '0.25rem' }}
          >
            Clear Overrides
          </Button>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button
                type="secondary"
                className={styles.dataTabAddButton}
                disabled={!(canMutateData && hasSchemas)}
                style={{ display: 'flex', gap: '0.25rem' }}
              >
                <TbPlus /> Add Data
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content className="cmp-context-menu" sideOffset={5}>
                {db.schemas.map(schema => (
                  <DropdownMenu.Item
                    key={schema.id}
                    className="cmp-context-menu__item"
                    onSelect={() => setAddItemDialog({ open: true, schemaId: schema.id })}
                    disabled={!db.isDataEditable(schema)}
                  >
                    {schema.name}
                  </DropdownMenu.Item>
                ))}
                <DropdownMenu.Arrow className="cmp-context-menu__arrow" />
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>

      {!hasSchemas && (
        <div className={styles.dataTabMessageBox}>
          <p>No schemas available</p>
          <p>Create schemas in the Schemas tab before adding data.</p>
        </div>
      )}

      {!canMutateData && (
        <div className={`${styles.dataTabMessageBox}`}>
          <p>The current data provider does not support data management.</p>
          <p>Switch to a different provider (like REST API) to manage data.</p>
        </div>
      )}

      {hasSchemas && (
        <>
          <div className={styles.dataTabSearchControls}>
            <div>
              <label className={styles.dataTabFilterLabel}>Filter by Schema:</label>
              <Select.Root value={selectedSchemaId} onChange={v => setSelectedSchemaId(v ?? 'all')}>
                <Select.Item value="all">All Schemas ({allDataItems.length} items)</Select.Item>
                {db.schemas.map(schema => {
                  return (
                    <Select.Item key={schema.id} value={schema.id}>
                      {schema.name}
                    </Select.Item>
                  );
                })}
              </Select.Root>
            </div>

            <div>
              <label className={styles.dataTabFilterLabel}>Search:</label>
              <div className={styles.dataTabSearchInputGroup}>
                <TextInput
                  ref={searchRef}
                  value={searchText}
                  onChange={v => setSearchText(v ?? '')}
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
                <Button
                  type="secondary"
                  onClick={handleSearch}
                  style={{ display: 'flex', gap: '0.25rem' }}
                >
                  <TbSearch /> Search
                </Button>
              </div>
            </div>
          </div>

          {/* Data Results */}
          {filteredDataItems.length === 0 && (
            <div className={styles.dataTab__messageBox}>
              {allDataItems.length === 0 ? (
                <p>No data items yet</p>
              ) : (
                <p>No items match your current filters</p>
              )}
            </div>
          )}

          {filteredDataItems.length > 0 && (
            <table className={styles.dataTabTable}>
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>
                    <input
                      type="checkbox"
                      checked={
                        selectedItems.size === filteredDataItems.length &&
                        filteredDataItems.length > 0
                      }
                      onChange={handleToggleSelectAll}
                    />
                  </th>
                  <th>Name</th>
                  <th>ID</th>
                  <th>Schema</th>
                  <th>Data</th>
                  <th>Overridden</th>
                  {canMutateData && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filteredDataItems.map(item => {
                  const primaryField = item._schema.fields[0];
                  const displayFields = item._schema.fields.slice(1, 3); // Show up to 2 additional fields
                  const overrideStatus = getOverrideStatus(document, item);

                  return (
                    <tr key={item._uid}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedItems.has(item._uid)}
                          onChange={() => handleToggleSelection(item._uid)}
                        />
                      </td>
                      <td>{primaryField ? getDisplayValue(item, primaryField) : '-'}</td>
                      <td>{item._uid.substring(0, 8)}</td>
                      <td>{item._schema.name}</td>
                      <td>
                        {displayFields.length > 0
                          ? shorten(
                              displayFields
                                .map(field => `${field.name}: ${getDisplayValue(item, field)}`)
                                .join(', '),
                              40
                            )
                          : '-'}
                      </td>
                      <td
                        data-status={overrideStatus.status}
                        className={styles.dataTabOverrideStatus}
                      >
                        {overrideStatus.text}
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
                              disabled={!db.isDataEditable(item._schema)}
                            >
                              <TbPencil />
                            </Button>
                            <Button
                              type="icon-only"
                              onClick={() => handleDeleteItem(item)}
                              title="Delete item"
                              disabled={!db.isDataEditable(item._schema)}
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

      <EditItemDialog
        open={addItemDialog.open}
        onClose={() => setAddItemDialog({ open: false })}
        selectedSchema={addItemDialog.schemaId}
      />
      <EditItemDialog
        open={editItemDialog.open}
        onClose={() => setEditItemDialog({ open: false })}
        selectedSchema={editItemDialog.schema?.id}
        editItem={editItemDialog.item}
      />
    </>
  );
};
