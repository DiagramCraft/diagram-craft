import { Button } from '@diagram-craft/app-components/Button';
import { TbEdit, TbPlus, TbTrash } from 'react-icons/tb';
import type { EntityTemplate } from '@arch-register/api-types/schemaContract';
import styles from './SchemaSettingsScreen.module.css';

export const SchemaTemplatesEditor = ({
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
