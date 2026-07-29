import { useMemo } from 'react';
import { TbColumns3, TbFilter, TbPlus, TbX } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { DateInput } from '@diagram-craft/app-components/DateInput';
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
import type { DocumentBrowserBaseColumnId, DocumentBrowserEmbedConfig } from './types';
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

export const fieldsForType = (documentTypes: DocumentType[], documentTypeId?: string) =>
  documentTypes.find(type => type.id === documentTypeId)?.fields.filter(field => !field.retired) ??
  [];

export const sanitizeConditions = (conditions: FilterCondition[], fields: DocumentField[]) => {
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

type Props = {
  value: DocumentBrowserEmbedConfig;
  onChange: (value: DocumentBrowserEmbedConfig) => void;
};

export const DocumentBrowserEmbedConfigForm = ({ value, onChange }: Props) => {
  const { workspaceSlug } = useWorkspaceContext();
  const { data: documentTypes = [] } = useDocumentTypes(workspaceSlug);

  const selectedFields = useMemo(
    () => fieldsForType(documentTypes, value.documentTypeId),
    [documentTypes, value.documentTypeId]
  );
  const sortOptions = useMemo(
    () => [
      { value: 'updated_at', label: 'Updated date' },
      { value: 'title', label: 'Title' },
      ...selectedFields.map(field => ({ value: field.id, label: field.name }))
    ],
    [selectedFields]
  );
  const sortValue = sortOptions.some(option => option.value === value.sort)
    ? value.sort
    : 'updated_at';

  const handleTypeChange = (typeValue: string | undefined) => {
    const nextTypeId = typeValue === ALL_TYPES ? undefined : typeValue;
    onChange({
      ...value,
      documentTypeId: nextTypeId,
      conditions: [],
      visibleFieldIds: [],
      sort: 'updated_at'
    });
  };

  const selectValue = value.documentTypeId ?? ALL_TYPES;

  return (
    <div className={styles.toolbar}>
      <SearchInput
        size="sm"
        className={styles.searchInline}
        value={value.q}
        onChange={q => onChange({ ...value, q })}
        onClear={() => onChange({ ...value, q: '' })}
        placeholder="Search document titles…"
      />
      <Select.Root
        value={selectValue}
        onChange={handleTypeChange}
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
            <Button size="sm" variant={value.conditions.length > 0 ? 'primary' : 'secondary'}>
              <TbFilter size={12} style={{ marginRight: 4 }} />
              Filter
              {value.conditions.length > 0 && (
                <span className={styles.filterCount}>{value.conditions.length}</span>
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
            conditions={value.conditions}
            onChange={conditions => onChange({ ...value, conditions })}
          />
        </Popover.Content>
      </Popover.Root>
      <div className={styles.toolbarSpacer} />
      <FilterDropdown
        label="Sort"
        value={sortValue}
        onChange={sort => onChange({ ...value, sort })}
        options={sortOptions}
      />
      <DocumentFieldsPopover
        visibleBaseColumnIds={value.visibleBaseColumnIds}
        onBaseColumnChange={visibleBaseColumnIds => onChange({ ...value, visibleBaseColumnIds })}
        fields={selectedFields}
        visibleFieldIds={value.visibleFieldIds}
        onChange={visibleFieldIds => onChange({ ...value, visibleFieldIds })}
      />
    </div>
  );
};
