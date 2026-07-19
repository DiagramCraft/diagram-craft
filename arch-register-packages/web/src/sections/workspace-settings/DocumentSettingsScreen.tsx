import { useEffect, useMemo, useRef, useState } from 'react';
import { getRouteApi } from '@tanstack/react-router';
import {
  TbPlus,
  TbTrash,
  TbArchive,
  TbEye,
  TbGripVertical,
  TbInfoCircle,
  TbFileText
} from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { Select } from '@diagram-craft/app-components/Select';
import { Checkbox } from '@diagram-craft/app-components/Checkbox';
import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import { ErrorDialog } from '@diagram-craft/app-components/ErrorDialog';
import type {
  DocumentAiAction,
  DocumentField,
  DocumentFieldType,
  DocumentMetadata,
  DocumentRequirement,
  DocumentTemplate,
  DocumentType,
  FieldMigrations,
  PendingFieldChange
} from '@arch-register/api-types/documentContract';
import {
  getDocumentTypeMigrationRequired,
  useArchiveDocumentTemplate,
  useArchiveDocumentType,
  useCreateDocumentTemplate,
  useCreateDocumentType,
  useDeleteDocumentTemplate,
  useDeleteDocumentType,
  useDocumentTemplates,
  useDocumentTypes,
  useUpdateDocumentTemplate,
  useUpdateDocumentType
} from '../../hooks/useDocuments';
import { useAiStatus } from '../../hooks/useAiConfig';
import { Chip } from '../../components/Chip';
import { TypeBadge } from '../../components/TypeBadge';
import { ICON_MAP } from '../../components/TypeBadge';
import { EmptyState } from '../../components/EmptyState';
import { LoadingState } from '../../components/LoadingState';
import { Title } from '../../components/Title';
import { resolveDocumentTypeColor, SCHEMA_ICONS } from '../../lib/schemaPresentation';
import { SCHEMA_COLORS } from '@arch-register/api-types/colors';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { toFieldId } from '../../utils/fieldId';
import { FieldMigrationDialog, FieldMigrationChoices } from '../../dialogs/FieldMigrationDialog';
import { settingsSectionTarget } from '../../routes/settingsNavigation';
import { DocumentTypeVersionHistorySubSection } from './sub-sections/DocumentTypeVersionHistorySubSection';
import styles from './DocumentSettingsScreen.module.css';

const FIELD_TYPE_OPTIONS: { value: DocumentFieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'long_text', label: 'Long text' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'date', label: 'Date' },
  { value: 'number', label: 'Number' },
  { value: 'enum', label: 'Enum' },
  { value: 'entity_link', label: 'Entity link' },
  { value: 'document_link', label: 'Document link' }
];

const REQUIREMENT_OPTIONS: { value: DocumentRequirement; label: string }[] = [
  { value: 'required', label: 'Required' },
  { value: 'expected', label: 'Expected' },
  { value: 'optional', label: 'Optional' }
];

const newDocumentField = (existingIds: ReadonlySet<string> = new Set<string>()): DocumentField => {
  let id = 'new_field';
  let suffix = 2;
  while (existingIds.has(id)) {
    id = `new_field_${suffix}`;
    suffix += 1;
  }
  return {
    id,
    name: id,
    type: 'text',
    requirement: 'optional',
    retired: false
  };
};

const newAiAction = (): DocumentAiAction => ({
  id: crypto.randomUUID(),
  name: '',
  kind: 'interactive',
  prompt: '',
  enabled: true
});

const isLinkType = (type: DocumentFieldType) => type === 'entity_link' || type === 'document_link';
const NEW_DOCUMENT_TYPE_ID = 'new';
const NEW_DOCUMENT_TEMPLATE_ID = 'new';

const routeApi = getRouteApi('/authenticated/$workspaceSlug/settings/documents');

export const DocumentSettingsScreen = () => {
  const navigate = routeApi.useNavigate();
  const search = routeApi.useSearch();
  const { workspaceSlug } = useWorkspaceContext();
  const activeTab = search.tab === 'templates' ? 'templates' : 'types';

  const { data: types = [], isLoading: typesLoading } = useDocumentTypes(workspaceSlug, true);
  const { data: templates = [], isLoading: templatesLoading } = useDocumentTemplates(
    workspaceSlug,
    null,
    true
  );

  const typeColor = useMemo(() => {
    const colors = new Map<string, string>();
    types.forEach((type, index) => colors.set(type.id, resolveDocumentTypeColor(type, index)));
    return colors;
  }, [types]);

  if (typesLoading || templatesLoading)
    return <LoadingState text="Loading document definitions…" size="sm" />;

  return (
    <div className={styles.screen}>
      {activeTab === 'types' ? (
        <DocumentTypeEditor
          workspaceSlug={workspaceSlug}
          types={types}
          typeColor={typeColor}
          selectedId={search.type ?? null}
          onSelect={id =>
            navigate({
              to: '/$workspaceSlug/settings/documents',
              params: { workspaceSlug },
              search: { tab: 'types', type: id }
            })
          }
        />
      ) : (
        <DocumentTemplateEditor
          workspaceSlug={workspaceSlug}
          templates={templates}
          types={types}
          selectedId={search.template ?? null}
          onSelect={id =>
            navigate({
              to: '/$workspaceSlug/settings/documents',
              params: { workspaceSlug },
              search: { tab: 'templates', template: id }
            })
          }
        />
      )}
    </div>
  );
};

// =====================================================================
// Document type editor
// =====================================================================

const DocumentTypeEditor = ({
  workspaceSlug,
  types,
  typeColor,
  selectedId,
  onSelect
}: {
  workspaceSlug: string;
  types: DocumentType[];
  typeColor: Map<string, string>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) => {
  const navigate = routeApi.useNavigate();
  const selected = types.find(type => type.id === selectedId) ?? null;
  const isNew = selectedId === NEW_DOCUMENT_TYPE_ID;

  const createType = useCreateDocumentType(workspaceSlug);
  const updateType = useUpdateDocumentType(workspaceSlug);
  const archiveType = useArchiveDocumentType(workspaceSlug);
  const deleteType = useDeleteDocumentType(workspaceSlug);
  const { data: aiStatus, isLoading: aiStatusLoading } = useAiStatus(workspaceSlug);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [fields, setFields] = useState<DocumentField[]>([]);
  const [aiActions, setAiActions] = useState<DocumentAiAction[]>([]);
  const [color, setColor] = useState<string | null>(null);
  const [icon, setIcon] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [pendingFieldChanges, setPendingFieldChanges] = useState<PendingFieldChange[] | null>(null);
  const fieldKeysRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    fieldKeysRef.current.clear();
    if (selected) {
      selected.fields.forEach(field => fieldKeysRef.current.set(field.id, crypto.randomUUID()));
      setName(selected.name);
      setDescription(selected.description);
      setFields(selected.fields);
      setAiActions(selected.aiActions);
      setColor(selected.color);
      setIcon(selected.icon);
      setDirty(false);
      setShowHistory(false);
      setPendingFieldChanges(null);
    } else if (isNew) {
      setName('');
      setDescription('');
      setFields([]);
      setAiActions([]);
      setColor(null);
      setIcon(null);
      setDirty(true);
    }
  }, [isNew, selected]);

  const updateField = (fieldId: string, patch: Partial<DocumentField>) => {
    if (patch.id !== undefined && patch.id !== fieldId) {
      const stableKey = fieldKeysRef.current.get(fieldId);
      if (stableKey) {
        fieldKeysRef.current.delete(fieldId);
        fieldKeysRef.current.set(patch.id, stableKey);
      }
    }
    setFields(current =>
      current.map(field =>
        field.id === fieldId ? ({ ...field, ...patch } as DocumentField) : field
      )
    );
    setDirty(true);
  };

  const removeField = (field: DocumentField) => {
    fieldKeysRef.current.delete(field.id);
    setFields(current => current.filter(item => item.id !== field.id));
    setDirty(true);
  };

  const addField = () => {
    const field = newDocumentField(new Set(fields.map(item => item.id)));
    fieldKeysRef.current.set(field.id, crypto.randomUUID());
    setFields(current => [...current, field]);
    setDirty(true);
  };

  const updateAiAction = (actionId: string, next: DocumentAiAction) => {
    setAiActions(current => current.map(action => (action.id === actionId ? next : action)));
    setDirty(true);
  };

  const removeAiAction = (actionId: string) => {
    setAiActions(current => current.filter(action => action.id !== actionId));
    setDirty(true);
  };

  const addAiAction = () => {
    setAiActions(current => [...current, newAiAction()]);
    setDirty(true);
  };

  const handleSave = async (fieldMigrations?: FieldMigrations) => {
    if (!dirty) return;
    try {
      const body = { name, description, fields, aiActions, color, icon, fieldMigrations };
      if (isNew) {
        const created = await createType.mutateAsync(body);
        onSelect(created.id);
      } else if (selected) {
        await updateType.mutateAsync({ id: selected.id, body });
        setDirty(false);
        setPendingFieldChanges(null);
      } else {
        return;
      }
    } catch (cause) {
      const migrationRequired = getDocumentTypeMigrationRequired(cause);
      if (migrationRequired) {
        setPendingFieldChanges(migrationRequired.pendingChanges);
        return;
      }
      setErrorMessage(cause instanceof Error ? cause.message : 'Failed to save document type');
    }
  };

  const confirmFieldMigrations = (choices: FieldMigrationChoices) => {
    if (!pendingFieldChanges) return;
    const fieldMigrations: FieldMigrations = {};
    for (const change of pendingFieldChanges) {
      const action = choices[change.fieldId] ?? 'remove';
      fieldMigrations[change.fieldId] =
        action === 'rename' ? { action, renameTo: change.renamedToId } : { action };
    }
    void handleSave(fieldMigrations);
  };

  const doDelete = async () => {
    if (!selected) return;
    setConfirmDelete(false);
    try {
      await deleteType.mutateAsync(selected.id);
      navigate({
        to: '/$workspaceSlug/settings/documents',
        params: { workspaceSlug },
        search: { tab: 'types' }
      });
    } catch (cause) {
      setErrorMessage(cause instanceof Error ? cause.message : 'Failed to delete document type');
    }
  };

  return (
    <>
      {selected || isNew ? (
        <div>
          <div className={styles.editorHead}>
            <Title
              breadcrumb={[
                {
                  label: 'Home',
                  onClick: () => navigate({ to: '/$workspaceSlug', params: { workspaceSlug } })
                },
                { label: 'Settings' }
              ]}
              icon={
                <TypeBadge
                  color={
                    color ??
                    (selected ? typeColor.get(selected.id) : undefined) ??
                    'var(--base-fg-dim)'
                  }
                  name={name ?? 'New document type'}
                  icon={icon}
                  size={26}
                />
              }
              title={name ?? 'New document type'}
              description={
                description ??
                `${fields.filter(field => !field.retired).length} fields${selected ? ` · version ${selected.version}` : ''}`
              }
            />
            {selected && (
              <Button variant="ghost" onClick={() => setShowHistory(v => !v)}>
                {showHistory ? 'Back to fields' : 'View history'}
              </Button>
            )}
          </div>
          {showHistory && selected ? (
            <DocumentTypeVersionHistorySubSection
              workspaceId={workspaceSlug}
              documentTypeId={selected.id}
            />
          ) : (
            <div className={styles.editor}>
              {selected?.archived && (
                <div className={styles.banner}>
                  <TbInfoCircle size={12} />
                  Archived — visible on existing documents for history, but not offered when
                  creating new ones.
                </div>
              )}

              <div className={styles.formRow}>
                <div>
                  <div className={styles.formLabel}>Name</div>
                  <TextInput
                    value={name}
                    onChange={value => {
                      setName(value ?? '');
                      setDirty(true);
                    }}
                    style={{ width: '100%' }}
                  />
                </div>
                <div style={{ flex: 2 }}>
                  <div className={styles.formLabel}>Description</div>
                  <TextInput
                    value={description}
                    onChange={value => {
                      setDescription(value ?? '');
                      setDirty(true);
                    }}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div className={styles.appearanceRow}>
                <div>
                  <div className={styles.formLabel}>Color</div>
                  <div className={styles.colorSwatches}>
                    {SCHEMA_COLORS.map(preset => (
                      <button
                        type="button"
                        key={preset}
                        className={`${styles.swatch} ${color === preset ? styles.swatchActive : ''}`}
                        style={{ background: preset }}
                        title={preset}
                        onClick={() => {
                          setColor(preset);
                          setDirty(true);
                        }}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <div className={styles.formLabel}>Icon</div>
                  <div className={styles.iconPicker}>
                    {SCHEMA_ICONS.map(id => {
                      const Icon = ICON_MAP[id];
                      return (
                        <button
                          type="button"
                          key={id}
                          className={`${styles.iconOption} ${icon === id ? styles.iconOptionActive : ''}`}
                          title={id}
                          onClick={() => {
                            setIcon(id);
                            setDirty(true);
                          }}
                        >
                          <Icon size={14} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className={styles.fieldsHead}>
                <div className={styles.sectionLabel}>Fields</div>
                <Button variant="ghost" icon={<TbPlus size={11} />} onClick={addField}>
                  Add field
                </Button>
              </div>

              {fields.length > 0 ? (
                <div className={styles.fieldsTable}>
                  <div className={styles.fieldsTh}>
                    <span />
                    <span>Field ID</span>
                    <span>Name</span>
                    <span>Type</span>
                    <span>Options / Cardinality</span>
                    <span>Requirement</span>
                    <span />
                  </div>
                  {fields.map(field => (
                    <DocumentFieldRow
                      key={fieldKeysRef.current.get(field.id) ?? field.id}
                      field={field}
                      onUpdate={patch => updateField(field.id, patch)}
                      onRemove={() => removeField(field)}
                    />
                  ))}
                </div>
              ) : (
                <div className={styles.fieldsTable}>
                  <div className={styles.fieldEmpty}>
                    No fields defined yet. Click &quot;Add field&quot; to get started.
                  </div>
                </div>
              )}
              <div className={styles.fieldsHint}>
                <TbInfoCircle size={11} />
                Fields already used by documents keep their value type. Renaming or removing a used
                field will ask you to choose how to migrate its data before saving.
              </div>

              {!aiStatusLoading && !aiStatus?.configured && (
                <div className={styles.fieldsHead}>
                  <div className={styles.sectionLabel}>AI Actions</div>
                </div>
              )}
              {!aiStatusLoading && !aiStatus?.configured && (
                <div className={styles.fieldsTable}>
                  <div className={styles.fieldEmpty}>
                    AI isn&apos;t configured for this workspace yet.{' '}
                    <button
                      type="button"
                      className={styles.linkButton}
                      onClick={() => navigate(settingsSectionTarget(workspaceSlug, 'ai'))}
                    >
                      Set up AI
                    </button>{' '}
                    to define metadata generators and interactive actions for this document type.
                  </div>
                </div>
              )}

              {aiStatus?.configured && (
                <>
                  <div className={styles.fieldsHead}>
                    <div className={styles.sectionLabel}>AI Actions</div>
                    <Button variant="ghost" icon={<TbPlus size={11} />} onClick={addAiAction}>
                      Add AI action
                    </Button>
                  </div>

                  {aiActions.length > 0 ? (
                    <div className={styles.fieldsTable}>
                      {aiActions.map(action => (
                        <DocumentAiActionRow
                          key={action.id}
                          action={action}
                          fields={fields}
                          claimedFieldIds={
                            new Set(
                              aiActions
                                .filter(
                                  (
                                    other
                                  ): other is Extract<
                                    DocumentAiAction,
                                    { kind: 'metadata_generator' }
                                  > => other.id !== action.id && other.kind === 'metadata_generator'
                                )
                                .map(other => other.outputFieldId)
                            )
                          }
                          onUpdate={next => updateAiAction(action.id, next)}
                          onRemove={() => removeAiAction(action.id)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className={styles.fieldsTable}>
                      <div className={styles.fieldEmpty}>
                        No AI actions defined yet. Click &quot;Add AI action&quot; to get started.
                      </div>
                    </div>
                  )}
                  <div className={styles.fieldsHint}>
                    <TbInfoCircle size={11} />
                    Interactive AI actions run a predefined prompt against the document body,
                    metadata, and location using read-only tools, and show the result in the
                    document sidebar. They cannot modify entities, documents, or metadata.
                  </div>
                </>
              )}

              <div className={styles.bottomActions}>
                {selected && (
                  <div className={styles.bottomActionGroup}>
                    <Button
                      variant="secondary"
                      icon={selected.archived ? <TbEye size={13} /> : <TbArchive size={13} />}
                      onClick={() =>
                        void archiveType.mutateAsync({
                          id: selected.id,
                          archived: !selected.archived
                        })
                      }
                    >
                      {selected.archived ? 'Unarchive' : 'Archive'}
                    </Button>
                    <Button
                      variant="danger"
                      icon={<TbTrash size={13} />}
                      onClick={() => setConfirmDelete(true)}
                    >
                      Delete
                    </Button>
                  </div>
                )}
                <Button
                  variant="primary"
                  onClick={() => void handleSave()}
                  disabled={!dirty || !name.trim() || createType.isPending || updateType.isPending}
                >
                  {createType.isPending || updateType.isPending ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <EmptyState
          title="No document type selected"
          subtitle="Select a document type from the sidebar, or create one."
          action={
            <Button
              variant="primary"
              icon={<TbPlus size={12} />}
              onClick={() => onSelect(NEW_DOCUMENT_TYPE_ID)}
            >
              New document type
            </Button>
          }
        />
      )}

      <DeleteConfirmationDialog
        open={confirmDelete}
        title="Delete document type?"
        message={
          selected ? (
            <>
              The document type <b>{selected.name}</b> will be permanently deleted.
            </>
          ) : (
            ''
          )
        }
        detail="Types used by existing documents can't be deleted — archive them instead."
        confirmLabel="Delete type"
        onConfirm={() => void doDelete()}
        onCancel={() => setConfirmDelete(false)}
      />
      <ErrorDialog
        open={errorMessage !== null}
        title="Something went wrong"
        message={errorMessage}
        onClose={() => setErrorMessage(null)}
      />
      <FieldMigrationDialog
        open={pendingFieldChanges !== null}
        pendingChanges={pendingFieldChanges ?? []}
        subjectLabel="document type"
        itemNoun="document"
        onCancel={() => setPendingFieldChanges(null)}
        onConfirm={confirmFieldMigrations}
      />
    </>
  );
};

const DocumentFieldRow = ({
  field,
  onUpdate,
  onRemove
}: {
  field: DocumentField;
  onUpdate: (patch: Partial<DocumentField>) => void;
  onRemove: () => void;
}) => {
  const [idUserEdited, setIdUserEdited] = useState(() => field.id !== toFieldId(field.name));

  if (field.retired) {
    return (
      <div className={`${styles.fieldRow} ${styles.fieldRowRetired}`}>
        <span className={styles.fieldHandle}>
          <TbGripVertical size={14} />
        </span>
        <span className={styles.fieldId}>{field.id}</span>
        <span>{field.name}</span>
        <span className="dim">{field.type}</span>
        <span className="dim">—</span>
        <span>
          <Chip tone="ghost">Retired</Chip>
        </span>
        <button
          type="button"
          className={styles.iconBtn}
          title="Restore field"
          onClick={() => onUpdate({ retired: false })}
        >
          <TbEye size={13} />
        </button>
      </div>
    );
  }

  return (
    <div className={styles.fieldRow}>
      <span className={styles.fieldHandle}>
        <TbGripVertical size={14} />
      </span>
      <TextInput
        value={field.id}
        onChange={value => {
          setIdUserEdited(true);
          onUpdate({ id: value ?? field.id });
        }}
        style={{ width: '100%', fontFamily: 'var(--font-mono)' }}
      />
      <TextInput
        value={field.name}
        onChange={value => {
          const name = value ?? '';
          if (!idUserEdited) onUpdate({ name, id: toFieldId(name) });
          else onUpdate({ name });
        }}
        style={{ width: '100%' }}
      />
      <Select.Root
        value={field.type}
        onChange={value => value && onUpdate({ type: value as DocumentFieldType })}
        style={{ width: '100%' }}
      >
        {FIELD_TYPE_OPTIONS.map(option => (
          <Select.Item key={option.value} value={option.value}>
            {option.label}
          </Select.Item>
        ))}
      </Select.Root>
      <span className={styles.fieldOptions}>
        {field.type === 'enum' ? (
          <TextInput
            value={(field.enumOptions ?? [])
              .map(option => `${option.value}:${option.label}`)
              .join(', ')}
            placeholder="proposed:Proposed, accepted:Accepted"
            onChange={value =>
              onUpdate({
                enumOptions: (value ?? '')
                  .split(',')
                  .map(option => option.trim())
                  .filter(Boolean)
                  .map(option => {
                    const [enumValue, ...label] = option.split(':');
                    return {
                      value: enumValue!.trim(),
                      label:
                        label.join(':').trim() === '' ? enumValue!.trim() : label.join(':').trim()
                    };
                  })
              })
            }
            style={{ width: '100%' }}
          />
        ) : isLinkType(field.type) ? (
          <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <TextInput
                value={field.minCardinality === undefined ? '' : String(field.minCardinality)}
                placeholder="Min"
                onChange={value =>
                  onUpdate({
                    minCardinality: value === '' || value === undefined ? undefined : Number(value)
                  })
                }
                style={{ width: 56 }}
              />
              <span className="dim">–</span>
              <TextInput
                value={field.maxCardinality === undefined ? '' : String(field.maxCardinality)}
                placeholder="Max"
                onChange={value =>
                  onUpdate({
                    maxCardinality: value === '' || value === undefined ? undefined : Number(value)
                  })
                }
                style={{ width: 56 }}
              />
            </span>
            <TextInput
              value={field.inverseName ?? ''}
              placeholder="Inverse label"
              onChange={value =>
                onUpdate({ inverseName: value?.trim() ? value.trim() : undefined })
              }
              style={{ width: '100%' }}
            />
          </span>
        ) : (
          <span className="dim">—</span>
        )}
      </span>
      <Select.Root
        value={field.requirement}
        onChange={value => value && onUpdate({ requirement: value as DocumentRequirement })}
        style={{ width: '100%' }}
      >
        {REQUIREMENT_OPTIONS.map(option => (
          <Select.Item key={option.value} value={option.value}>
            {option.label}
          </Select.Item>
        ))}
      </Select.Root>
      <button type="button" className={styles.iconBtn} onClick={onRemove}>
        <TbTrash size={13} />
      </button>
    </div>
  );
};

const AI_ACTION_KIND_OPTIONS: { value: DocumentAiAction['kind']; label: string }[] = [
  { value: 'interactive', label: 'Interactive' },
  { value: 'metadata_generator', label: 'Metadata generator' }
];

const DocumentAiActionRow = ({
  action,
  fields,
  claimedFieldIds,
  onUpdate,
  onRemove
}: {
  action: DocumentAiAction;
  fields: DocumentField[];
  claimedFieldIds: ReadonlySet<string>;
  onUpdate: (next: DocumentAiAction) => void;
  onRemove: () => void;
}) => {
  const eligibleFields = fields.filter(
    field => !field.retired && !isLinkType(field.type) && !claimedFieldIds.has(field.id)
  );

  const handleKindChange = (kind: string | undefined) => {
    if (kind === 'metadata_generator') {
      onUpdate({
        id: action.id,
        name: action.name,
        prompt: action.prompt,
        enabled: action.enabled,
        kind: 'metadata_generator',
        outputFieldId: eligibleFields[0]?.id ?? ''
      });
    } else if (kind === 'interactive') {
      onUpdate({
        id: action.id,
        name: action.name,
        prompt: action.prompt,
        enabled: action.enabled,
        kind: 'interactive'
      });
    }
  };

  return (
    <div className={styles.aiActionRow}>
      <TextInput
        value={action.name}
        onChange={value => onUpdate({ ...action, name: value ?? '' })}
        placeholder="Action name"
        style={{ width: '100%' }}
      />
      <Select.Root value={action.kind} onChange={handleKindChange} style={{ width: '100%' }}>
        {AI_ACTION_KIND_OPTIONS.map(option => (
          <Select.Item key={option.value} value={option.value}>
            {option.label}
          </Select.Item>
        ))}
      </Select.Root>
      <TextArea
        value={action.prompt}
        onChange={value => onUpdate({ ...action, prompt: value ?? '' })}
        rows={2}
        style={{ width: '100%' }}
      />
      <div>
        {action.kind === 'metadata_generator' &&
          (eligibleFields.length > 0 || action.outputFieldId ? (
            <Select.Root
              value={action.outputFieldId}
              onChange={fieldId => onUpdate({ ...action, outputFieldId: fieldId ?? '' })}
              style={{ width: '100%' }}
            >
              {eligibleFields
                .concat(
                  fields.filter(
                    field => field.id === action.outputFieldId && !eligibleFields.includes(field)
                  )
                )
                .map(field => (
                  <Select.Item key={field.id} value={field.id}>
                    {field.name}
                  </Select.Item>
                ))}
            </Select.Root>
          ) : (
            <div className="dim" style={{ fontSize: 11 }}>
              No eligible fields — add a text, long text, boolean, date, number, or enum field
              first.
            </div>
          ))}
      </div>
      <Checkbox
        value={action.enabled}
        onChange={value => onUpdate({ ...action, enabled: value ?? false })}
      />
      <button type="button" className={styles.iconBtn} onClick={onRemove}>
        <TbTrash size={13} />
      </button>
    </div>
  );
};

// =====================================================================
// Template editor
// =====================================================================

const DocumentTemplateEditor = ({
  workspaceSlug,
  templates,
  types,
  selectedId,
  onSelect
}: {
  workspaceSlug: string;
  templates: DocumentTemplate[];
  types: DocumentType[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) => {
  const navigate = routeApi.useNavigate();
  const selected = templates.find(template => template.id === selectedId) ?? null;
  const isNew = selectedId === NEW_DOCUMENT_TEMPLATE_ID;

  const createTemplate = useCreateDocumentTemplate(workspaceSlug);
  const updateTemplate = useUpdateDocumentTemplate(workspaceSlug);
  const archiveTemplate = useArchiveDocumentTemplate(workspaceSlug);
  const deleteTemplate = useDeleteDocumentTemplate(workspaceSlug);

  const [name, setName] = useState('');
  const [documentTypeId, setDocumentTypeId] = useState('');
  const [body, setBody] = useState('# {{title}}\n');
  const [defaults, setDefaults] = useState<DocumentMetadata>({});
  const [dirty, setDirty] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (selected) {
      setName(selected.name);
      setDocumentTypeId(selected.document_type_id);
      setBody(selected.body);
      setDefaults(selected.metadata_defaults);
      setDirty(false);
    } else if (isNew) {
      setName('');
      setDocumentTypeId(types.find(type => !type.archived)?.id ?? '');
      setBody('# {{title}}\n');
      setDefaults({});
      setDirty(true);
    }
  }, [isNew, selected, types]);

  const selectedType = types.find(type => type.id === documentTypeId) ?? null;

  const patchDefault = (fieldId: string, value: DocumentMetadata[string] | null | undefined) => {
    setDefaults(current => {
      if (value === undefined || value === null) {
        const next = { ...current };
        delete next[fieldId];
        return next;
      }
      return { ...current, [fieldId]: value };
    });
    setDirty(true);
  };

  const handleSave = async () => {
    if (!dirty || !documentTypeId) return;
    try {
      const templateBody = {
        name,
        body,
        document_type_id: documentTypeId,
        metadata_defaults: defaults,
        project_id: null
      };
      if (isNew) {
        const created = await createTemplate.mutateAsync(templateBody);
        onSelect(created.id);
      } else if (selected) {
        await updateTemplate.mutateAsync({ id: selected.id, body: templateBody });
        setDirty(false);
      }
    } catch (cause) {
      setErrorMessage(cause instanceof Error ? cause.message : 'Failed to save template');
    }
  };

  const doDelete = async () => {
    if (!selected) return;
    setConfirmDelete(false);
    try {
      await deleteTemplate.mutateAsync(selected.id);
      navigate({
        to: '/$workspaceSlug/settings/documents',
        params: { workspaceSlug },
        search: { tab: 'templates' }
      });
    } catch (cause) {
      setErrorMessage(cause instanceof Error ? cause.message : 'Failed to delete template');
    }
  };

  return (
    <>
      {selected || isNew ? (
        <div>
          <div className={styles.editorHead}>
            <Title
              breadcrumb={[
                {
                  label: 'Home',
                  onClick: () => navigate({ to: '/$workspaceSlug', params: { workspaceSlug } })
                },
                { label: 'Settings' }
              ]}
              icon={
                <TypeBadge
                  color={
                    selectedType
                      ? resolveDocumentTypeColor(selectedType, types.indexOf(selectedType))
                      : 'var(--base-fg-dim)'
                  }
                  name={selectedType?.name}
                  icon={selectedType?.icon}
                  size={26}
                />
              }
              title={name ?? 'New template'}
              description={`For ${selectedType ? selectedType.name : 'an unknown type'}${selectedType?.archived ? ' · archived type' : ''}`}
            />
          </div>
          <div className={styles.editor}>
            <div className={styles.formRow}>
              <div>
                <div className={styles.formLabel}>Name</div>
                <TextInput
                  value={name}
                  onChange={value => {
                    setName(value ?? '');
                    setDirty(true);
                  }}
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <div className={styles.formLabel}>Document type</div>
                <Select.Root
                  value={documentTypeId}
                  onChange={value => {
                    setDocumentTypeId(value ?? '');
                    setDirty(true);
                  }}
                  style={{ width: '100%' }}
                >
                  {types
                    .filter(type => !type.archived || type.id === documentTypeId)
                    .map(type => (
                      <Select.Item key={type.id} value={type.id}>
                        {type.name}
                        {type.archived ? ' (archived)' : ''}
                      </Select.Item>
                    ))}
                </Select.Root>
              </div>
            </div>

            <div className={styles.sectionLabel}>Markdown body</div>
            <TextArea
              value={body}
              onChange={value => {
                setBody(value ?? '');
                setDirty(true);
              }}
              rows={10}
              allowMaximize={false}
              style={{ width: '100%' }}
            />

            <div className={styles.sectionLabel}>Structured metadata defaults</div>
            {selectedType ? (
              <div className={styles.defaultsGrid}>
                {selectedType.fields.filter(field => !field.retired).length === 0 ? (
                  <div className={styles.fieldEmpty}>This document type has no fields.</div>
                ) : (
                  selectedType.fields
                    .filter(field => !field.retired)
                    .map(field => (
                      <div key={field.id} className={styles.defaultRow}>
                        <div className={styles.defaultLabel}>
                          <span>{field.name}</span>
                          {field.requirement === 'optional' && (
                            <span className={styles.optionalLabel}>(optional)</span>
                          )}
                        </div>
                        <TemplateDefaultInput
                          field={field}
                          value={defaults[field.id]}
                          onChange={value => patchDefault(field.id, value)}
                        />
                      </div>
                    ))
                )}
              </div>
            ) : (
              <div className={styles.fieldEmpty}>Select a document type to set field defaults.</div>
            )}

            <div className={styles.bottomActions}>
              {selected && (
                <div className={styles.bottomActionGroup}>
                  <Button
                    variant="secondary"
                    icon={selected.archived ? <TbEye size={13} /> : <TbArchive size={13} />}
                    onClick={() =>
                      void archiveTemplate.mutateAsync({
                        id: selected.id,
                        archived: !selected.archived
                      })
                    }
                  >
                    {selected.archived ? 'Unarchive' : 'Archive'}
                  </Button>
                  <Button
                    variant="danger"
                    icon={<TbTrash size={13} />}
                    onClick={() => setConfirmDelete(true)}
                  >
                    Delete
                  </Button>
                </div>
              )}
              <Button
                variant="primary"
                onClick={() => void handleSave()}
                disabled={
                  !dirty ||
                  !name.trim() ||
                  !documentTypeId ||
                  createTemplate.isPending ||
                  updateTemplate.isPending
                }
              >
                {createTemplate.isPending || updateTemplate.isPending ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <EmptyState
          icon={<TbFileText size={22} />}
          title="No template selected"
          subtitle="Select a template from the sidebar, or create one."
          action={
            <Button
              variant="primary"
              icon={<TbPlus size={12} />}
              onClick={() => onSelect(NEW_DOCUMENT_TEMPLATE_ID)}
            >
              New template
            </Button>
          }
        />
      )}

      <DeleteConfirmationDialog
        open={confirmDelete}
        title="Delete template?"
        message={
          selected ? (
            <>
              The template <b>{selected.name}</b> will be permanently deleted.
            </>
          ) : (
            ''
          )
        }
        detail="Templates used to create documents can't be deleted — archive them instead."
        confirmLabel="Delete template"
        onConfirm={() => void doDelete()}
        onCancel={() => setConfirmDelete(false)}
      />
      <ErrorDialog
        open={errorMessage !== null}
        title="Something went wrong"
        message={errorMessage}
        onClose={() => setErrorMessage(null)}
      />
    </>
  );
};

const TemplateDefaultInput = ({
  field,
  value,
  onChange
}: {
  field: DocumentField;
  value: DocumentMetadata[string] | undefined;
  onChange: (value: DocumentMetadata[string] | null | undefined) => void;
}) => {
  if (field.type === 'enum') {
    return (
      <Select.Root
        value={typeof value === 'string' ? value : ''}
        onChange={v => onChange(v ?? undefined)}
        placeholder="— none —"
        style={{ width: '100%' }}
      >
        {(field.enumOptions ?? []).map(option => (
          <Select.Item key={option.value} value={option.value}>
            {option.label}
          </Select.Item>
        ))}
      </Select.Root>
    );
  }
  if (field.type === 'boolean') {
    return (
      <Select.Root
        value={typeof value === 'boolean' ? String(value) : ''}
        onChange={v => onChange(v === undefined ? undefined : v === 'true')}
        placeholder="— unset —"
        style={{ width: '100%' }}
      >
        <Select.Item value="true">True</Select.Item>
        <Select.Item value="false">False</Select.Item>
      </Select.Root>
    );
  }
  if (field.type === 'date') {
    return (
      <input
        type="date"
        value={typeof value === 'string' ? value : ''}
        onChange={event => onChange(event.target.value ?? undefined)}
      />
    );
  }
  if (field.type === 'number') {
    return (
      <TextInput
        value={typeof value === 'number' ? String(value) : ''}
        onChange={v => onChange(v === undefined || v === '' ? undefined : Number(v))}
        style={{ width: '100%' }}
      />
    );
  }
  if (isLinkType(field.type)) {
    const links = Array.isArray(value) ? value : [];
    return (
      <TextInput
        value={links.join(', ')}
        placeholder="IDs separated by commas"
        onChange={v =>
          onChange(
            (v ?? '')
              .split(',')
              .map(item => item.trim())
              .filter(Boolean)
          )
        }
        style={{ width: '100%' }}
      />
    );
  }
  return (
    <TextInput
      value={typeof value === 'string' ? value : ''}
      onChange={v => onChange(v ?? undefined)}
      style={{ width: '100%' }}
    />
  );
};
