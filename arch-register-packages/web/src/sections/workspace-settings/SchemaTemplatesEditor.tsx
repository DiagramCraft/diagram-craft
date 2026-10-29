import { useState } from 'react';
import { Button } from '@diagram-craft/app-components/Button';
import { TbEdit, TbPlus, TbTrash } from 'react-icons/tb';
import type {
  EntitySchema,
  EntityTemplate,
  SchemaField,
  SchemaGroup
} from '@arch-register/api-types/schemaContract';
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
  <>
    <div className={styles.fieldsHead}>
      <div className={styles.sectionLabel}>Entity templates</div>
      {canEdit && (
        <Button variant="ghost" icon={<TbPlus size={11} />} onClick={onAdd}>
          Add template
        </Button>
      )}
    </div>
    <div className={styles.templateList}>
      {templates.length === 0 ? (
        <div className={styles.templateEmpty}>No templates defined.</div>
      ) : (
        templates.map(template => (
          <div className={styles.templateRow} key={template.id}>
            <div>
              <div className={styles.templateName}>{template.name}</div>
              <div className={styles.templateSummary}>
                {Object.keys(template.values.fields).length} field defaults
              </div>
            </div>
            {canEdit && (
              <div className={styles.templateActions}>
                <Button
                  variant="ghost"
                  icon={<TbEdit size={12} />}
                  onClick={() => onEdit(template)}
                >
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  icon={<TbTrash size={12} />}
                  onClick={() => onDelete(template.id)}
                >
                  Delete
                </Button>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  </>
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
