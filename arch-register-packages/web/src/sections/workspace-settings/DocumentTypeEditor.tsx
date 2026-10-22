import { getRouteApi } from '@tanstack/react-router';
import { TbArchive, TbEye, TbInfoCircle, TbPlus } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import { ErrorDialog } from '@diagram-craft/app-components/ErrorDialog';
import type { DocumentType } from '@arch-register/api-types/documentContract';
import { TypeBadge } from '../../components/TypeBadge';
import { ICON_MAP } from '../../components/TypeBadge';
import { EmptyState } from '../../components/EmptyState';
import { Title } from '../../components/Title';
import { SCHEMA_ICONS } from '../../lib/schemaPresentation';
import { SCHEMA_COLORS } from '@arch-register/api-types/colors';
import { FieldMigrationDialog } from '../../dialogs/FieldMigrationDialog';
import { DocumentTypeVersionHistorySubSection } from './sub-sections/DocumentTypeVersionHistorySubSection';
import { FieldConfigList } from '../../components/FieldConfigList';
import { DocumentAiActionsSection } from './DocumentAiActionsSection';
import { DocumentFieldRow } from './DocumentFieldRow';
import { EditorActionsMenu, EditorSaveButtons } from './EditorActionsMenu';
import { NEW_DOCUMENT_TYPE_ID, useDocumentTypeDraft } from './useDocumentTypeDraft';
import styles from './DocumentSettingsScreen.module.css';

const FIELDS_LIST_ID = 'document-fields';

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

  const draft = useDocumentTypeDraft({
    workspaceSlug,
    selected,
    isNew,
    onSelect,
    onDeleted: () =>
      navigate({
        to: '/$workspaceSlug/settings/documents',
        params: { workspaceSlug },
        search: { tab: 'types' }
      })
  });

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
              eyebrow="Document type"
              icon={
                <TypeBadge
                  color={
                    draft.color ??
                    (selected ? typeColor.get(selected.id) : undefined) ??
                    'var(--base-fg-dim)'
                  }
                  name={draft.name || 'New document type'}
                  icon={draft.icon}
                  size={26}
                />
              }
              title={draft.name || 'New document type'}
              description={
                draft.description ||
                `${draft.fields.filter(field => !field.retired).length} fields${selected ? ` · version ${selected.version}` : ''}`
              }
              buttons={
                <EditorSaveButtons
                  canSave={draft.dirty && draft.name.trim() !== ''}
                  dirty={draft.dirty}
                  pending={draft.isSaving}
                  onSave={() => void draft.save()}
                  onCancel={draft.revert}
                />
              }
              menu={
                selected ? (
                  <EditorActionsMenu
                    deleteLabel="Delete type"
                    onDelete={() => draft.setConfirmDelete(true)}
                    extraItems={[
                      {
                        label: selected.archived ? 'Unarchive' : 'Archive',
                        icon: selected.archived ? <TbEye size={14} /> : <TbArchive size={14} />,
                        onClick: () => void draft.toggleArchived()
                      }
                    ]}
                  />
                ) : undefined
              }
            />
          </div>
          {selected && (
            <Tabs.Root
              value={draft.showHistory ? 'history' : 'edit'}
              onValueChange={value => draft.setShowHistory(value === 'history')}
            >
              <Tabs.List aria-label="Editor views">
                <Tabs.Trigger value="edit">Edit</Tabs.Trigger>
                <Tabs.Trigger value="history">Version history</Tabs.Trigger>
              </Tabs.List>
            </Tabs.Root>
          )}
          {draft.showHistory && selected ? (
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
                    value={draft.name}
                    onChange={value => draft.setName(value ?? '')}
                    style={{ width: '100%' }}
                  />
                </div>
                <div style={{ flex: 2 }}>
                  <div className={styles.formLabel}>Description</div>
                  <TextInput
                    value={draft.description}
                    onChange={value => draft.setDescription(value ?? '')}
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
                        className={`${styles.swatch} ${draft.color === preset ? styles.swatchActive : ''}`}
                        style={{ background: preset }}
                        title={preset}
                        onClick={() => draft.setColor(preset)}
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
                          className={`${styles.iconOption} ${draft.icon === id ? styles.iconOptionActive : ''}`}
                          title={id}
                          onClick={() => draft.setIcon(id)}
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
                <Button variant="ghost" icon={<TbPlus size={11} />} onClick={draft.addField}>
                  Add field
                </Button>
              </div>

              {draft.fields.length > 0 ? (
                <div className={styles.fieldsTable}>
                  <FieldConfigList
                    items={draft.fields}
                    getId={field => draft.fieldKeys.get(field.id) ?? field.id}
                    listId={FIELDS_LIST_ID}
                    onReorder={draft.reorderFields}
                    renderItem={(field, _index, drag) => (
                      <DocumentFieldRow
                        field={field}
                        onUpdate={patch => draft.updateField(field.id, patch)}
                        onRemove={() => draft.removeField(field)}
                        dragHandleRef={drag.ref}
                      />
                    )}
                  />
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

              <DocumentAiActionsSection
                workspaceSlug={workspaceSlug}
                documentTypeId={selected?.id ?? null}
                fields={draft.fields}
                aiActions={draft.aiActions}
                onChange={draft.setAiActions}
              />
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
        open={draft.confirmDelete}
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
        onConfirm={() => void draft.remove()}
        onCancel={() => draft.setConfirmDelete(false)}
      />
      <ErrorDialog
        open={draft.errorMessage !== null}
        title="Something went wrong"
        message={draft.errorMessage}
        onClose={() => draft.setErrorMessage(null)}
      />
      <FieldMigrationDialog
        open={draft.pendingFieldChanges !== null}
        pendingChanges={draft.pendingFieldChanges ?? []}
        subjectLabel="document type"
        itemNoun="document"
        onCancel={() => draft.setPendingFieldChanges(null)}
        onConfirm={draft.confirmFieldMigrations}
      />
    </>
  );
};
