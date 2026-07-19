import { useEffect, useState } from 'react';
import { getRouteApi } from '@tanstack/react-router';
import { TbPlus, TbTrash, TbArchive, TbEye, TbFileText } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { Select } from '@diagram-craft/app-components/Select';

import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import { ErrorDialog } from '@diagram-craft/app-components/ErrorDialog';
import type {
  DocumentMetadata,
  DocumentTemplate,
  DocumentType
} from '@arch-register/api-types/documentContract';
import {
  useArchiveDocumentTemplate,
  useCreateDocumentTemplate,
  useDeleteDocumentTemplate,
  useUpdateDocumentTemplate
} from '../../hooks/useDocuments';

import { TypeBadge } from '../../components/TypeBadge';

import { EmptyState } from '../../components/EmptyState';

import { Title } from '../../components/Title';
import { resolveDocumentTypeColor } from '../../lib/schemaPresentation';

import styles from './DocumentSettingsScreen.module.css';

const NEW_DOCUMENT_TEMPLATE_ID = 'new';
const routeApi = getRouteApi('/authenticated/$workspaceSlug/settings/documents');
export const DocumentTemplateEditor = ({
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

import { TemplateDefaultInput } from './TemplateDefaultInput';
