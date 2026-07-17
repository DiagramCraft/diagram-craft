import { useEffect, useMemo, useState } from 'react';
import { useEditorRef } from 'platejs/react';
import type { TElement } from 'platejs';
import { TbColumns3, TbFilter, TbPlus, TbX } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { DateInput } from '@diagram-craft/app-components/DateInput';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { Popover } from '@diagram-craft/app-components/Popover';
import { Select } from '@diagram-craft/app-components/Select';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import type { DocumentField, DocumentType } from '@arch-register/api-types/documentContract';
import type { FilterCondition } from '@arch-register/api-types/viewContract';
import { EmptyState } from '../../../../../components/EmptyState';
import { FilterDropdown } from '../../../../../components/FilterDropdown';
import filterStyles from '../../../../../components/FilterBuilder.module.css';
import { SearchInput } from '../../../../../components/SearchInput';
import { useDocumentTypes } from '../../../../../hooks/useDocuments';
import { useWorkspaceContext } from '../../../../../layouts/WorkspaceContext';
import { DialogContent } from '../../../editor/BlockDialog';
import { DocumentBrowserEmbed } from './DocumentBrowserEmbed';
import {
  decodeDocumentBrowserEmbedConfig,
  encodeDocumentBrowserEmbedConfig
} from './DocumentBrowserEmbedCodec';
import {
  DOCUMENT_BROWSER_BASE_COLUMN_IDS,
  type DocumentBrowserBaseColumnId,
  type DocumentBrowserEmbedConfig,
  type DocumentBrowserEmbedSlateElement
} from './types';
import styles from './DocumentBrowserEmbedDialog.module.css';

const ALL_TYPES = '__all__';
const UNTYPED = 'none';
const BASE_COLUMN_OPTIONS: Array<{ id: DocumentBrowserBaseColumnId; label: string }> = [
  { id: 'document_type', label: 'Document type' },
  { id: 'location', label: 'Location' },
  { id: 'updated_at', label: 'Updated' }
];

const TEXT_OPERATORS = [
  ['contains', 'Contains'],
  ['equals', 'Equals'],
  ['not_equals', 'Not equals'],
  ['starts_with', 'Starts with'],
  ['ends_with', 'Ends with'],
  ['empty', 'Is empty'],
  ['not_empty', 'Is not empty']
] as const;
const SELECT_OPERATORS = [
  ['equals', 'Equals'],
  ['not_equals', 'Not equals'],
  ['empty', 'Is empty'],
  ['not_empty', 'Is not empty']
] as const;
const NUMBER_OPERATORS = [
  ['equals', 'Equals'],
  ['not_equals', 'Not equals'],
  ['gt', 'Greater than'],
  ['lt', 'Less than'],
  ['gte', 'At least'],
  ['lte', 'At most'],
  ['empty', 'Is empty'],
  ['not_empty', 'Is not empty']
] as const;
const DATE_OPERATORS = [
  ['on', 'On'],
  ['before', 'Before'],
  ['after', 'After'],
  ['empty', 'Is empty'],
  ['not_empty', 'Is not empty']
] as const;

const fieldKind = (field: DocumentField) => {
  if (field.type === 'date') return 'date';
  if (field.type === 'enum' || field.type === 'boolean') return 'select';
  if (field.type === 'number') return 'number';
  return 'text';
};

const operatorsFor = (field: DocumentField) => {
  const kind = fieldKind(field);
  if (kind === 'date') return DATE_OPERATORS;
  if (kind === 'select') return SELECT_OPERATORS;
  if (kind === 'number') return NUMBER_OPERATORS;
  return TEXT_OPERATORS;
};

const defaultOperator = (field: DocumentField): FilterCondition['op'] => {
  const kind = fieldKind(field);
  if (kind === 'date') return 'on';
  if (kind === 'select' || kind === 'number') return 'equals';
  return 'contains';
};

const fieldsForType = (documentTypes: DocumentType[], documentTypeId?: string) =>
  documentTypes.find(type => type.id === documentTypeId)?.fields.filter(field => !field.retired) ??
  [];

const sanitizeConditions = (conditions: FilterCondition[], fields: DocumentField[]) => {
  const available = new Set(fields.map(field => field.id));
  return conditions.filter(condition => available.has(condition.fieldId));
};

const MetadataFilterBuilder = ({
  fields,
  conditions,
  onChange
}: {
  fields: DocumentField[];
  conditions: FilterCondition[];
  onChange: (conditions: FilterCondition[]) => void;
}) => {
  const addCondition = () => {
    const field = fields[0];
    if (!field) return;
    onChange([...conditions, { fieldId: field.id, op: defaultOperator(field), value: '' }]);
  };

  const updateCondition = (index: number, update: Partial<FilterCondition>) => {
    const next = [...conditions];
    const updated = { ...next[index]!, ...update };

    if (update.fieldId) {
      const field = fields.find(item => item.id === update.fieldId);
      if (field) {
        updated.op = defaultOperator(field);
        updated.value = '';
      }
    }

    next[index] = updated;
    onChange(next);
  };

  const clearAll = () => onChange([]);

  return (
    <div className={filterStyles.container}>
      <div className={filterStyles.header}>
        <span className={filterStyles.headerTitle}>Filters</span>
        {conditions.length > 0 && (
          <button type="button" className={filterStyles.clearAll} onClick={clearAll}>
            Clear all
          </button>
        )}
      </div>
      <div className={filterStyles.rows}>
        {conditions.length === 0 && <EmptyState compact title="No filters applied." />}
        {conditions.map((condition, index) => {
          const field = fields.find(item => item.id === condition.fieldId) ?? fields[0];
          if (!field) return null;
          const kind = fieldKind(field);
          const operators = operatorsFor(field);
          const showValue = condition.op !== 'empty' && condition.op !== 'not_empty';
          const selectOptions: Array<[string, string]> =
            field.type === 'boolean'
              ? [
                  ['true', 'True'],
                  ['false', 'False']
                ]
              : (field.enumOptions ?? []).map(option => [option.value, option.label]);

          return (
            <div className={filterStyles.row} key={`${condition.fieldId}-${index}`}>
              <div className={filterStyles.rowHead}>
                <div className={filterStyles.tokField}>
                  <Select.Root
                    value={condition.fieldId}
                    onChange={value => updateCondition(index, { fieldId: value })}
                  >
                    {fields.map(item => (
                      <Select.Item key={item.id} value={item.id}>
                        {item.name}
                      </Select.Item>
                    ))}
                  </Select.Root>
                </div>
                <div className={filterStyles.tokOp}>
                  <Select.Root
                    value={condition.op}
                    onChange={value =>
                      updateCondition(index, {
                        op: value as FilterCondition['op'],
                        value: value === 'empty' || value === 'not_empty' ? '' : condition.value
                      })
                    }
                  >
                    {operators.map(([value, label]) => (
                      <Select.Item key={value} value={value}>
                        {label}
                      </Select.Item>
                    ))}
                  </Select.Root>
                </div>
              </div>
              {showValue && (
                <div className={filterStyles.rowBody}>
                  {kind === 'select' ? (
                    <Select.Root
                      value={String(condition.value ?? '')}
                      onChange={value => updateCondition(index, { value: value ?? '' })}
                    >
                      <Select.Item value="">Select…</Select.Item>
                      {selectOptions.map(([value, label]) => (
                        <Select.Item key={value} value={value}>
                          {label}
                        </Select.Item>
                      ))}
                    </Select.Root>
                  ) : kind === 'date' ? (
                    <DateInput
                      value={String(condition.value ?? '')}
                      onChange={value => updateCondition(index, { value: value ?? '' })}
                    />
                  ) : (
                    <TextInput
                      type={kind === 'number' ? 'number' : 'text'}
                      value={String(condition.value ?? '')}
                      onChange={value =>
                        updateCondition(index, {
                          value: kind === 'number' && value ? Number(value) : (value ?? '')
                        })
                      }
                    />
                  )}
                </div>
              )}
              <button
                type="button"
                className={filterStyles.removeBtn}
                onClick={() => onChange(conditions.filter((_, itemIndex) => itemIndex !== index))}
                aria-label="Remove filter"
                title="Remove filter"
              >
                <TbX size={11} />
              </button>
            </div>
          );
        })}
      </div>
      <div className={filterStyles.footer}>
        <button
          type="button"
          className={filterStyles.addFilter}
          onClick={addCondition}
          disabled={fields.length === 0}
        >
          <TbPlus size={11} />
          Add filter
        </button>
      </div>
    </div>
  );
};

const DocumentFieldsPopover = ({
  visibleBaseColumnIds,
  onBaseColumnChange,
  fields,
  visibleFieldIds,
  onChange
}: {
  visibleBaseColumnIds: DocumentBrowserBaseColumnId[];
  onBaseColumnChange: (columnIds: DocumentBrowserBaseColumnId[]) => void;
  fields: DocumentField[];
  visibleFieldIds: string[];
  onChange: (fieldIds: string[]) => void;
}) => (
  <Popover.Root>
    <Popover.Trigger
      element={
        <Button
          size="sm"
          variant="secondary"
          icon={<TbColumns3 size={12} />}
          aria-label="Visible metadata columns"
          title="Visible metadata columns"
        />
      }
    />
    <Popover.Content
      sideOffset={4}
      align="end"
      arrow={false}
      closeButton={false}
      className={styles.columnsPopover}
    >
      <div className={styles.columnsPopoverTitle}>Columns</div>
      <div className={styles.columnsGroup}>
        <div className={styles.columnsGroupLabel}>Document details</div>
        <div className={styles.columns}>
          {BASE_COLUMN_OPTIONS.map(column => (
            <label key={column.id} className={styles.columnOption}>
              <input
                type="checkbox"
                checked={visibleBaseColumnIds.includes(column.id)}
                onChange={() =>
                  onBaseColumnChange(
                    visibleBaseColumnIds.includes(column.id)
                      ? visibleBaseColumnIds.filter(id => id !== column.id)
                      : [...visibleBaseColumnIds, column.id]
                  )
                }
              />
              {column.label}
            </label>
          ))}
        </div>
      </div>
      <div className={styles.columnsGroup}>
        <div className={styles.columnsGroupLabel}>Metadata</div>
        {fields.length === 0 ? (
          <div className={styles.muted}>Select a document type to choose metadata columns.</div>
        ) : (
          <div className={styles.columns}>
            {fields.map(field => (
              <label key={field.id} className={styles.columnOption}>
                <input
                  type="checkbox"
                  checked={visibleFieldIds.includes(field.id)}
                  onChange={() =>
                    onChange(
                      visibleFieldIds.includes(field.id)
                        ? visibleFieldIds.filter(id => id !== field.id)
                        : [...visibleFieldIds, field.id]
                    )
                  }
                />
                {field.name}
              </label>
            ))}
          </div>
        )}
      </div>
    </Popover.Content>
  </Popover.Root>
);

export const DocumentBrowserEmbedDialog = ({
  element,
  open,
  onClose,
  isNew
}: {
  element: TElement;
  open: boolean;
  onClose: () => void;
  isNew: boolean;
}) => {
  const editor = useEditorRef();
  const { workspaceSlug } = useWorkspaceContext();
  const { data: documentTypes = [] } = useDocumentTypes(workspaceSlug);
  const initialConfig = useMemo(
    () => decodeDocumentBrowserEmbedConfig((element as DocumentBrowserEmbedSlateElement).config),
    [element]
  );
  const [q, setQ] = useState('');
  const [documentTypeId, setDocumentTypeId] = useState<string | undefined>();
  const [conditions, setConditions] = useState<FilterCondition[]>([]);
  const [sort, setSort] = useState('updated_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [visibleBaseColumnIds, setVisibleBaseColumnIds] = useState<
    DocumentBrowserBaseColumnId[]
  >([...DOCUMENT_BROWSER_BASE_COLUMN_IDS]);
  const [visibleFieldIds, setVisibleFieldIds] = useState<string[]>([]);

  const selectedFields = useMemo(
    () => fieldsForType(documentTypes, documentTypeId),
    [documentTypeId, documentTypes]
  );
  const previewConfig: DocumentBrowserEmbedConfig = useMemo(
    () => ({
      q,
      documentTypeId,
      conditions,
      sort,
      sortDir,
      visibleBaseColumnIds,
      visibleFieldIds
    }),
    [conditions, documentTypeId, q, sort, sortDir, visibleBaseColumnIds, visibleFieldIds]
  );
  const sortOptions = useMemo(
    () => [
      { value: 'updated_at', label: 'Updated date' },
      { value: 'title', label: 'Title' },
      ...selectedFields.map(field => ({ value: field.id, label: field.name }))
    ],
    [selectedFields]
  );

  useEffect(() => {
    if (!open) return;
    setQ(initialConfig?.q ?? '');
    setDocumentTypeId(initialConfig?.documentTypeId);
    setConditions(initialConfig?.conditions ?? []);
    setSort(initialConfig?.sort ?? 'updated_at');
    setSortDir(initialConfig?.sortDir ?? 'desc');
    setVisibleBaseColumnIds(
      initialConfig?.visibleBaseColumnIds ?? [...DOCUMENT_BROWSER_BASE_COLUMN_IDS]
    );
    setVisibleFieldIds(initialConfig?.visibleFieldIds ?? []);
  }, [initialConfig, open]);

  useEffect(() => {
    if (!sortOptions.some(option => option.value === sort)) setSort('updated_at');
  }, [sort, sortOptions]);

  const handleTypeChange = (value: string | undefined) => {
    const nextTypeId = value === ALL_TYPES ? undefined : value;
    setDocumentTypeId(nextTypeId);
    setConditions([]);
    setVisibleFieldIds([]);
    setSort('updated_at');
  };

  const handleConfirm = () => {
    const path = editor.api.findPath(element);
    if (!path) {
      onClose();
      return;
    }

    const snapshot: DocumentBrowserEmbedConfig = {
      q,
      documentTypeId,
      conditions: sanitizeConditions(conditions, selectedFields),
      sort,
      sortDir,
      visibleBaseColumnIds,
      visibleFieldIds: visibleFieldIds.filter(id => selectedFields.some(field => field.id === id))
    };
    editor.tf.setNodes({ config: encodeDocumentBrowserEmbedConfig(snapshot) }, { at: path });
    onClose();
  };

  const handleClose = () => {
    if (isNew) {
      const path = editor.api.findPath(element);
      if (path) editor.tf.removeNodes({ at: path });
    }
    onClose();
  };

  const selectValue = documentTypeId ?? ALL_TYPES;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Document browser"
      width="min(1200px, 92vw)"
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: handleClose },
        { label: 'Save', type: 'default', onClick: handleConfirm }
      ]}
    >
      <DialogContent>
        <div className={styles.toolbar}>
          <SearchInput
            size="sm"
            className={styles.searchInline}
            value={q}
            onChange={setQ}
            onClear={() => setQ('')}
            placeholder="Search document titles…"
          />
          <Select.Root
            value={selectValue}
            onChange={value => handleTypeChange(value)}
            style={{ width: 190, minWidth: 190, flex: '0 0 190px' }}
          >
            <Select.Item value={ALL_TYPES}>All document types</Select.Item>
            <Select.Item value={UNTYPED}>Untyped Markdown</Select.Item>
            {documentTypes
              .filter(type => !type.archived)
              .map(type => (
                <Select.Item key={type.id} value={type.id}>
                  {type.name}
                </Select.Item>
              ))}
          </Select.Root>
          <Popover.Root>
            <Popover.Trigger
              element={
                <Button size="sm" variant={conditions.length > 0 ? 'primary' : 'secondary'}>
                  <TbFilter size={12} style={{ marginRight: 4 }} />
                  Filter
                  {conditions.length > 0 && (
                    <span className={styles.filterCount}>{conditions.length}</span>
                  )}
                </Button>
              }
            />
            <Popover.Content
              sideOffset={4}
              align="start"
              arrow={false}
              closeButton={false}
              className={styles.filterPopover}
            >
              <MetadataFilterBuilder
                fields={selectedFields}
                conditions={conditions}
                onChange={setConditions}
              />
            </Popover.Content>
          </Popover.Root>
          <div className={styles.toolbarSpacer} />
          <FilterDropdown label="Sort" value={sort} onChange={setSort} options={sortOptions} />
          <DocumentFieldsPopover
            visibleBaseColumnIds={visibleBaseColumnIds}
            onBaseColumnChange={setVisibleBaseColumnIds}
            fields={selectedFields}
            visibleFieldIds={visibleFieldIds}
            onChange={setVisibleFieldIds}
          />
        </div>
        <div className={styles.preview}>
          <DocumentBrowserEmbed config={encodeDocumentBrowserEmbedConfig(previewConfig)} />
        </div>
      </DialogContent>
    </Dialog>
  );
};
