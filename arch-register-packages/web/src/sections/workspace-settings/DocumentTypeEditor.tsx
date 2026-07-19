import { useEffect, useRef, useState } from 'react';
import { getRouteApi } from '@tanstack/react-router';
import { TbPlus, TbTrash, TbArchive, TbEye, TbInfoCircle } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';

import { TextInput } from '@diagram-craft/app-components/TextInput';

import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import { ErrorDialog } from '@diagram-craft/app-components/ErrorDialog';
import type {
  DocumentAiAction,
  DocumentField,
  DocumentType,
  FieldMigrations,
  PendingFieldChange
} from '@arch-register/api-types/documentContract';
import {
  getDocumentTypeMigrationRequired,
  useArchiveDocumentType,
  useCreateDocumentType,
  useDeleteDocumentType,
  useUpdateDocumentType
} from '../../hooks/useDocuments';
import { useAiStatus } from '../../hooks/useAiConfig';

import { TypeBadge } from '../../components/TypeBadge';
import { ICON_MAP } from '../../components/TypeBadge';
import { EmptyState } from '../../components/EmptyState';

import { Title } from '../../components/Title';
import { SCHEMA_ICONS } from '../../lib/schemaPresentation';
import { SCHEMA_COLORS } from '@arch-register/api-types/colors';

import { FieldMigrationDialog, FieldMigrationChoices } from '../../dialogs/FieldMigrationDialog';
import { settingsSectionTarget } from '../../routes/settingsNavigation';
import { DocumentTypeVersionHistorySubSection } from './sub-sections/DocumentTypeVersionHistorySubSection';
import styles from './DocumentSettingsScreen.module.css';

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

const NEW_DOCUMENT_TYPE_ID = 'new';

const routeApi = getRouteApi('/authenticated/$workspaceSlug/settings/documents');
export const DocumentTypeEditor = ({
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

import { DocumentFieldRow } from './DocumentFieldRow';
import { DocumentAiActionRow } from './DocumentAiActionRow';
