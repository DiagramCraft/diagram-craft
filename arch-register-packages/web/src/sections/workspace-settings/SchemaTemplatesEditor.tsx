import { useState } from 'react';
import { Button } from '@diagram-craft/app-components/Button';
import { TbEdit } from 'react-icons/tb';
import type {
  EntitySchema,
  EntityTemplate,
  SchemaField,
  SchemaGroup
} from '@arch-register/api-types/schemaContract';
import { ListEditor } from '../../components/ListEditor';
import { EntityTemplateDialog } from '../../dialogs/EntityTemplateDialog';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import type { EntityEditorExtra } from './entitySchemaAdapter';
import { useCanEditSchemas, useSchemaEditor } from './schemaEditorContext';
import styles from './SchemaSettingsScreen.module.css';

const TemplateList = ({
  templates,
  canEdit,
  onAdd,
  onEdit,
  onDelete
}: {
  templates: EntityTemplate[];
  canEdit: boolean;
  onAdd: () => void;
  onEdit: (template: EntityTemplate) => void;
  onDelete: (templateId: string) => void;
}) => (
  <ListEditor
    operations
    label="Entity templates"
    layout="card"
    addLabel="Add template"
    items={templates}
    getId={template => template.id}
    disabled={!canEdit}
    emptyMessage="No templates defined."
    removeLabel="Delete template"
    onAdd={onAdd}
    onRemove={template => onDelete(template.id)}
    renderItem={template => (
      <div>
        <div className={styles.templateName}>{template.name}</div>
        <div className={styles.templateSummary}>
          {Object.keys(template.values.fields).length} field defaults
        </div>
      </div>
    )}
    renderActions={template => (
      <Button
        variant="icon-only"
        size="sm"
        icon={<TbEdit size={12} />}
        aria-label="Edit template"
        title="Edit template"
        onClick={() => onEdit(template)}
      />
    )}
  />
);

/** Templates tab of the entity schema editor; owns the template dialog. */
export const SchemaTemplatesTab = () => {
  const editor = useSchemaEditor<SchemaField, SchemaGroup, EntityEditorExtra, EntitySchema>();
  const canEdit = useCanEditSchemas();
  const { workspaceSlug, teams, lifecycleStates } = useWorkspaceContext();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EntityTemplate | null>(null);
  const { draft, selected } = editor;

  if (!draft) return null;

  const saveTemplate = (template: EntityTemplate) => {
    editor.updateDraft(current => {
      const exists = current.templates.some(item => item.id === template.id);
      return {
        ...current,
        templates: exists
          ? current.templates.map(item => (item.id === template.id ? template : item))
          : [...current.templates, template]
      };
    });
    setDialogOpen(false);
  };

  return (
    <>
      <TemplateList
        templates={draft.templates}
        canEdit={canEdit}
        onAdd={() => {
          setEditing(null);
          setDialogOpen(true);
        }}
        onEdit={template => {
          setEditing(template);
          setDialogOpen(true);
        }}
        onDelete={templateId =>
          editor.updateDraft(current => ({
            ...current,
            templates: current.templates.filter(template => template.id !== templateId)
          }))
        }
      />
      {selected && (
        <EntityTemplateDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          onSave={saveTemplate}
          workspaceId={workspaceSlug}
          schema={{ ...selected, fields: draft.fields, templates: draft.templates } as EntitySchema}
          template={editing}
          templates={draft.templates}
          teams={teams}
          lifecycleStates={lifecycleStates}
        />
      )}
    </>
  );
};
