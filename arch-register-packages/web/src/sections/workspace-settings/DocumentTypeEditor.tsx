import { DraftPill } from './DraftPill';
import { useState } from 'react';
import { getRouteApi } from '@tanstack/react-router';
import { TbArchive, TbEye, TbHistory, TbInfoCircle, TbPlus } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import { ErrorDialog } from '@diagram-craft/app-components/ErrorDialog';
import type { DocumentType } from '@arch-register/api-types/documentContract';
import { TypeBadge } from '../../components/TypeBadge';
import { IconPicker } from '../../components/IconPicker';
import { EmptyState } from '../../components/EmptyState';
import { Title } from '../../components/Title';
import { Panel } from '../../components/Panel';
import { Stack } from '../../components/Stack';
import { ColorPicker } from '../../components/ColorPicker';
import { FieldMigrationDialog } from '../../dialogs/FieldMigrationDialog';
import { VersionHistoryDialog } from './sub-sections/VersionHistoryDialog';
import { DocumentTypeVersionHistorySubSection } from './sub-sections/DocumentTypeVersionHistorySubSection';
import { ListEditor } from '../../components/ListEditor';
import { DocumentAiActionsSection } from './DocumentAiActionsSection';
import { DocumentFieldRow } from './DocumentFieldRow';
import { EditorActionsMenu, EditorSaveButtons } from './EditorActionsMenu';
import { NEW_DOCUMENT_TYPE_ID, useDocumentTypeDraft } from './useDocumentTypeDraft';
import styles from './DocumentSettingsScreen.module.css';
import { FormElement } from '@diagram-craft/app-components/FormElement';

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
  const [panelTab, setPanelTab] = useState('fields');
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

  const editorBody = (
    <Panel>
      <Stack>
        {selected?.archived && (
          <div className={styles.banner}>
            <TbInfoCircle size={12} />
            Archived — visible on existing documents for history, but not offered when creating new
            ones.
          </div>
        )}

        <div className={styles.formRow}>
          <FormElement label={'Name'}>
            <TextInput
              value={draft.name}
              onChange={value => draft.setName(value ?? '')}
              style={{ width: '100%' }}
            />
          </FormElement>

          <FormElement label={'Description'}>
            <TextInput
              value={draft.description}
              onChange={value => draft.setDescription(value ?? '')}
              style={{ width: '100%' }}
            />
          </FormElement>
        </div>

        <div className={styles.appearanceRow}>
          <FormElement label={'Color'}>
            <ColorPicker size="small" value={draft.color} onChange={c => c && draft.setColor(c)} />
          </FormElement>

          <FormElement label={'Icon'}>
            <IconPicker
              value={draft.icon ?? undefined}
              onChange={value => value && draft.setIcon(value)}
            />
          </FormElement>
        </div>

        <Tabs.Root autoHeight value={panelTab} onValueChange={setPanelTab}>
          <Tabs.List aria-label="Document type sections">
            <Tabs.Trigger value="fields">Fields</Tabs.Trigger>
            <Tabs.Trigger value="ai">AI actions</Tabs.Trigger>
          </Tabs.List>
          <Tabs.Content value="fields">
            <ListEditor
              label="Fields"
              items={draft.fields}
              getId={field => draft.fieldKeys.get(field.id) ?? field.id}
              addLabel="Add field"
              emptyMessage={'No fields defined yet. Click "Add field" to get started.'}
              layout="bare"
              reorder="drag"
              operations
              onAdd={draft.addField}
              onMove={draft.reorderFields}
              renderItem={(field, { dragRef }) => (
                <DocumentFieldRow
                  field={field}
                  onUpdate={patch => draft.updateField(field.id, patch)}
                  onRemove={() => draft.removeField(field)}
                  dragHandleRef={dragRef}
                />
              )}
            />
            <div className={styles.fieldsHint}>
              <TbInfoCircle size={11} />
              Fields already used by documents keep their value type. Renaming or removing a used
              field will ask you to choose how to migrate its data before saving.
            </div>
          </Tabs.Content>
          <Tabs.Content value="ai">
            <DocumentAiActionsSection
              workspaceSlug={workspaceSlug}
              documentTypeId={selected?.id ?? null}
              fields={draft.fields}
              aiActions={draft.aiActions}
              onChange={draft.setAiActions}
            />
          </Tabs.Content>
        </Tabs.Root>
      </Stack>
    </Panel>
  );

  return (
    <>
      {selected || isNew ? (
        <>
          <Title
            breadcrumb={[
              {
                label: 'Home',
                onClick: () => navigate({ to: '/$workspaceSlug', params: { workspaceSlug } })
              },
              { label: 'Settings' }
            ]}
            eyebrow="Document type"
            chips={<DraftPill kind="document_type" id={selected?.id} />}
            icon={
              <TypeBadge
                color={
                  draft.color ??
                  (selected ? typeColor.get(selected.id) : undefined) ??
                  'var(--base-fg-secondary)'
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
                  draftItem={{ kind: 'document_type', id: selected.id }}
                  onDelete={() => draft.setConfirmDelete(true)}
                  extraItems={[
                    {
                      label: 'Version history',
                      icon: <TbHistory size={14} />,
                      onClick: () => draft.setShowHistory(true)
                    },
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

          {editorBody}
        </>
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

      {selected && (
        <VersionHistoryDialog open={draft.showHistory} onClose={() => draft.setShowHistory(false)}>
          <DocumentTypeVersionHistorySubSection
            workspaceId={workspaceSlug}
            documentTypeId={selected.id}
          />
        </VersionHistoryDialog>
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
