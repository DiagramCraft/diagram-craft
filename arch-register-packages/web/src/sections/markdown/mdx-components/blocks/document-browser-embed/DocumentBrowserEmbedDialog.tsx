import { useEffect, useMemo, useState } from 'react';
import { useEditorRef } from 'platejs/react';
import type { TElement } from 'platejs';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { Select } from '@diagram-craft/app-components/Select';
import type { DocumentField, DocumentType } from '@arch-register/api-types/documentContract';
import type { FilterCondition } from '@arch-register/api-types/viewContract';
import { SearchInput } from '../../../../../components/SearchInput';
import { useDocumentTypes } from '../../../../../hooks/useDocuments';
import { useEntity } from '../../../../../hooks/useEntities';
import { useWorkspaceContext } from '../../../../../layouts/WorkspaceContext';
import { useMdxContext } from '../../../MdxContext';
import { DialogContent, DialogSection } from '../../../editor/BlockDialog';
import { DocumentBrowserEmbed } from './DocumentBrowserEmbed';
import {
  decodeDocumentBrowserEmbedConfig,
  encodeDocumentBrowserEmbedConfig
} from './DocumentBrowserEmbedCodec';
import type { DocumentBrowserEmbedConfig, DocumentBrowserEmbedSlateElement } from './types';
import styles from './DocumentBrowserEmbedDialog.module.css';

const ALL_TYPES = '__all__';
const UNTYPED = 'none';

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

const displayLocation = (
  projectId?: string,
  entityId?: string,
  projects?: { id: string; public_id: string; name: string }[],
  entityName?: string
) => {
  if (projectId) {
    const project = projects?.find(item => item.id === projectId || item.public_id === projectId);
    return `Project: ${project?.name ?? projectId}`;
  }
  if (entityId) return `Entity: ${entityName ?? entityId}`;
  return 'Workspace';
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
    next[index] = { ...next[index]!, ...update };
    onChange(next);
  };

  return (
    <div className={styles.filterBuilder}>
      {conditions.length === 0 && <div className={styles.muted}>No metadata filters applied.</div>}
      {conditions.map((condition, index) => {
        const field = fields.find(item => item.id === condition.fieldId) ?? fields[0];
        if (!field) return null;
        const kind = fieldKind(field);
        const operators = operatorsFor(field);
        const showValue = condition.op !== 'empty' && condition.op !== 'not_empty';

        return (
          <div className={styles.filterRow} key={`${condition.fieldId}-${index}`}>
            <select
              value={condition.fieldId}
              onChange={event => {
                const nextField = fields.find(item => item.id === event.target.value) ?? field;
                updateCondition(index, {
                  fieldId: nextField.id,
                  op: defaultOperator(nextField),
                  value: ''
                });
              }}
            >
              {fields.map(item => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <select
              value={condition.op}
              onChange={event =>
                updateCondition(index, {
                  op: event.target.value as FilterCondition['op'],
                  value:
                    event.target.value === 'empty' || event.target.value === 'not_empty'
                      ? ''
                      : condition.value
                })
              }
            >
              {operators.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            {showValue &&
              (kind === 'select' ? (
                <select
                  value={String(condition.value ?? '')}
                  onChange={event => updateCondition(index, { value: event.target.value })}
                >
                  <option value="">Select…</option>
                  {field.type === 'boolean'
                    ? [
                        ['true', 'True'],
                        ['false', 'False']
                      ].map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))
                    : (field.enumOptions ?? []).map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                </select>
              ) : (
                <input
                  type={kind === 'date' ? 'date' : kind === 'number' ? 'number' : 'text'}
                  value={String(condition.value ?? '')}
                  onChange={event =>
                    updateCondition(index, {
                      value:
                        kind === 'number' && event.target.value
                          ? Number(event.target.value)
                          : event.target.value
                    })
                  }
                />
              ))}
            <button
              type="button"
              className={styles.removeFilter}
              onClick={() => onChange(conditions.filter((_, itemIndex) => itemIndex !== index))}
              aria-label="Remove metadata filter"
            >
              ×
            </button>
          </div>
        );
      })}
      <button
        type="button"
        className={styles.addFilter}
        onClick={addCondition}
        disabled={fields.length === 0}
      >
        + Add metadata filter
      </button>
    </div>
  );
};

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
  const { workspaceSlug, projects } = useWorkspaceContext();
  const { projectId, entityId } = useMdxContext();
  const { data: documentTypes = [] } = useDocumentTypes(workspaceSlug);
  const { data: entity } = useEntity(workspaceSlug, entityId ?? '');
  const initialConfig = useMemo(
    () => decodeDocumentBrowserEmbedConfig((element as DocumentBrowserEmbedSlateElement).config),
    [element]
  );
  const [q, setQ] = useState('');
  const [documentTypeId, setDocumentTypeId] = useState<string | undefined>();
  const [conditions, setConditions] = useState<FilterCondition[]>([]);
  const [sort, setSort] = useState('updated_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [visibleFieldIds, setVisibleFieldIds] = useState<string[]>([]);

  const selectedFields = useMemo(
    () => fieldsForType(documentTypes, documentTypeId),
    [documentTypeId, documentTypes]
  );
  const previewConfig: DocumentBrowserEmbedConfig = useMemo(
    () => ({ q, documentTypeId, conditions, sort, sortDir, visibleFieldIds }),
    [conditions, documentTypeId, q, sort, sortDir, visibleFieldIds]
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
        <div className={styles.controls}>
          <div className={styles.controlRow}>
            <SearchInput
              size="sm"
              value={q}
              onChange={setQ}
              onClear={() => setQ('')}
              placeholder="Search document titles…"
            />
            <Select.Root
              value={selectValue}
              onChange={value => handleTypeChange(value)}
              style={{ minWidth: 190 }}
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
          </div>
          <div className={styles.location}>
            {displayLocation(projectId, entityId, projects, entity?._name)}
          </div>
          <DialogSection label="Metadata filters">
            <MetadataFilterBuilder
              fields={selectedFields}
              conditions={conditions}
              onChange={setConditions}
            />
          </DialogSection>
          <div className={styles.controlRow}>
            <Select.Root value={sort} onChange={value => setSort(value ?? 'updated_at')}>
              {sortOptions.map(option => (
                <Select.Item key={option.value} value={option.value}>
                  Sort: {option.label}
                </Select.Item>
              ))}
            </Select.Root>
            <Select.Root
              value={sortDir}
              onChange={value => setSortDir(value === 'asc' ? 'asc' : 'desc')}
            >
              <Select.Item value="desc">Descending</Select.Item>
              <Select.Item value="asc">Ascending</Select.Item>
            </Select.Root>
          </div>
          <DialogSection label="Visible metadata columns">
            {selectedFields.length === 0 ? (
              <div className={styles.muted}>Select a document type to choose metadata columns.</div>
            ) : (
              <div className={styles.columns}>
                {selectedFields.map(field => (
                  <label key={field.id} className={styles.columnOption}>
                    <input
                      type="checkbox"
                      checked={visibleFieldIds.includes(field.id)}
                      onChange={() =>
                        setVisibleFieldIds(current =>
                          current.includes(field.id)
                            ? current.filter(id => id !== field.id)
                            : [...current, field.id]
                        )
                      }
                    />
                    {field.name}
                  </label>
                ))}
              </div>
            )}
          </DialogSection>
        </div>
        <div className={styles.preview}>
          <DocumentBrowserEmbed config={encodeDocumentBrowserEmbedConfig(previewConfig)} />
        </div>
      </DialogContent>
    </Dialog>
  );
};
