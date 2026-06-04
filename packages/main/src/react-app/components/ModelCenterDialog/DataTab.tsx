import { useEffect, useMemo, useRef, useState } from 'react';
import { useApplication, useDiagram, useDocument } from '../../../application';
import { Data } from '@diagram-craft/model/dataProvider';
import { DataSchema } from '@diagram-craft/model/diagramDocumentDataSchemas';
import { Button } from '@diagram-craft/app-components/Button';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { TbChevronDown, TbDots, TbPlus, TbTrash } from 'react-icons/tb';
import { EditItemDialog } from '../EditItemDialog';
import { MessageDialogCommand } from '@diagram-craft/canvas/context';
import styles from './DataTab.module.css';
import type { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import { asyncExecuteWithErrorDialog } from '../../ErrorBoundary';
import { shorten } from '@diagram-craft/utils/strings';
import { DataManagerUndoableFacade } from '@diagram-craft/model/diagramDocumentDataUndoActions';
import { MenuButton } from '@diagram-craft/app-components/MenuButton';
import { Menu } from '@diagram-craft/app-components/Menu';

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
  const diagram = useDiagram();
  const application = useApplication();
  const searchRef = useRef<HTMLInputElement>(null);

  const [allDataItems, setAllDataItems] = useState<DataItemWithSchema[]>([]);
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
  const dbUndoable = useMemo(
    () => new DataManagerUndoableFacade(diagram.undoManager, db),
    [diagram.undoManager, db]
  );

  useEffect(() => {
    const buildItems = () => {
      const allItems: DataItemWithSchema[] = [];
      for (const schema of db.schemas) {
        allItems.push(...db.getData(schema).map(item => ({ ...item, _schema: schema }) as DataItemWithSchema));
      }
      return allItems;
    };

    setAllDataItems(buildItems());

    const handleDataChange = () => setAllDataItems(buildItems());
    db.on('addData', handleDataChange);
    db.on('updateData', handleDataChange);
    db.on('deleteData', handleDataChange);

    return () => {
      db.off('addData', handleDataChange);
      db.off('updateData', handleDataChange);
      db.off('deleteData', handleDataChange);
    };
  }, [db]);

  const filteredDataItems = useMemo(
    () => filterItems(allDataItems, selectedSchemaId, searchText),
    [allDataItems, selectedSchemaId, searchText]
  );

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
          await dbUndoable.deleteData(item._schema, item);
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
    <div className={styles.icDataTab}>
      <div className={styles.eHeader}>
        <p className={styles.eTitle}>Data</p>
        <div className={styles.eHeaderActions}>
          <Button
            onClick={handleApplySelectedOverrides}
            disabled={!allSelectedHaveOverrides}
          >
            Apply Overrides
          </Button>
          <Button
            variant="danger"
            onClick={handleClearSelectedOverrides}
            disabled={!allSelectedHaveOverrides}
          >
            Clear Overrides
          </Button>
          <MenuButton.Root>
            <MenuButton.Trigger
              variant="primary"
              size={"md"}
              disabled={!(canMutateData && hasSchemas)}
              style={{ display: 'flex', gap: '0.25rem' }}
            >
              <TbPlus /> Add Data
            </MenuButton.Trigger>
            <MenuButton.Menu>
              {db.schemas.map(schema => (
                <Menu.Item
                  key={schema.id}
                  onClick={() => setAddItemDialog({ open: true, schemaId: schema.id })}
                  disabled={!db.isDataEditable(schema)}
                >
                  {schema.name}
                </Menu.Item>
              ))}
            </MenuButton.Menu>
          </MenuButton.Root>
        </div>
      </div>

      {!hasSchemas && (
        <div className={styles.eMessage}>
          <p>No schemas available</p>
          <p>Create schemas in the Schemas tab before adding data.</p>
        </div>
      )}

      {!canMutateData && (
        <div className={styles.eMessage}>
          <p>The current data provider does not support data management.</p>
          <p>Switch to a different provider (like REST API) to manage data.</p>
        </div>
      )}

      {hasSchemas && (
        <>
          <div className={styles.eToolbar}>
            <label className={styles.eFilter}>
              <span className={styles.eFilterLabel}>Schema</span>
              <select
                className={styles.eFilterSelect}
                value={selectedSchemaId}
                onChange={e => setSelectedSchemaId(e.target.value)}
              >
                <option value="all">All ({allDataItems.length})</option>
                {db.schemas.map(schema => (
                  <option key={schema.id} value={schema.id}>{schema.name}</option>
                ))}
              </select>
              <TbChevronDown size={10} />
            </label>
            <TextInput
              ref={searchRef}
              variant={'search'}
              placeholder="Search…"
              value={searchText}
              onChange={value => setSearchText(value ?? '')}
              onKeyDown={e => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  e.stopPropagation();
                  setSearchText('');
                  searchRef.current?.blur();
                }
              }}
              style={{ minWidth: '200px' }}
            />
          </div>

          {filteredDataItems.length === 0 && (
            <div className={styles.eMessage}>
              {allDataItems.length === 0 ? (
                <p>No data items yet</p>
              ) : (
                <p>No items match your current filters</p>
              )}
            </div>
          )}

          {filteredDataItems.length > 0 && (
            <div className={styles.eTableWrap}>
              <table className={styles.eTable}>
              <thead>
                <tr>
                  <th className={styles.eCheckbox}>
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
                  {canMutateData && <th style={{ width: 28 }} />}
                </tr>
              </thead>
              <tbody>
                {filteredDataItems.map(item => {
                  const primaryField = item._schema.fields[0];
                  const displayFields = item._schema.fields.slice(1, 3);
                  const overrideStatus = getOverrideStatus(document, item);

                  const isEditable = canMutateData && db.isDataEditable(item._schema);
                  return (
                    <tr
                      key={item._uid}
                      onClick={isEditable ? () => setEditItemDialog({ open: true, item, schema: item._schema }) : undefined}
                      style={isEditable ? { cursor: 'pointer' } : undefined}
                    >
                      <td className={styles.eCheckbox} onClick={ev => ev.stopPropagation()}>
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
                      <td data-status={overrideStatus.status} className={styles.eOverrideStatus}>
                        {overrideStatus.text}
                      </td>
                      {canMutateData && (
                        <td onClick={ev => ev.stopPropagation()}>
                          {isEditable && (
                            <MenuButton.Root>
                              <MenuButton.Trigger element={<button type="button" className={styles.eDotsBtn}><TbDots size={14} /></button>} />
                              <MenuButton.Menu>
                                <Menu.Item type="danger" leftSlot={<TbTrash size={13} />} onClick={() => handleDeleteItem(item)}>Delete</Menu.Item>
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
    </div>
  );
};
