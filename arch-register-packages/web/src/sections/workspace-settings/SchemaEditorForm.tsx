import type {
  EntitySchema,
  SchemaField,
  SchemaGroup
} from '@arch-register/api-types/schemaContract';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import type { EntityEditorExtra } from './entitySchemaAdapter';
import { SchemaEditorFormShell } from './SchemaEditorFormShell';
import { SchemaEditorTabs } from './SchemaEditorTabs';
import { useCanEditSchemas, useSchemaEditor } from './schemaEditorContext';
import styles from './SchemaSettingsScreen.module.css';

const deriveKeyPrefix = (value: string) =>
  value
    .replace(/[^a-z]/gi, '')
    .toUpperCase()
    .slice(0, 5);

/** Editor form for an entity type: key prefix on top of the shared form, then the tabs. */
export const SchemaEditorForm = () => {
  const editor = useSchemaEditor<SchemaField, SchemaGroup, EntityEditorExtra, EntitySchema>();
  const canEdit = useCanEditSchemas();
  if (!editor.draft) return null;

  return (
    <SchemaEditorFormShell
      descriptionPlaceholder="What does this entity type represent?"
      onNameChange={value =>
        editor.updateDraft(current => ({
          ...current,
          name: value,
          keyPrefix:
            !editor.dirty || current.keyPrefix === deriveKeyPrefix(current.name)
              ? deriveKeyPrefix(value)
              : current.keyPrefix
        }))
      }
      beforeDescription={
        <div className={styles.formRow}>
          <div>
            <div className={styles.formLabel}>Key Prefix</div>
            <TextInput
              value={editor.draft.keyPrefix}
              disabled={!canEdit}
              onChange={value =>
                editor.updateDraft(current => ({
                  ...current,
                  keyPrefix: (value ?? '').toUpperCase()
                }))
              }
              style={{ width: '100%' }}
            />
          </div>
        </div>
      }
    >
      <SchemaEditorTabs />
    </SchemaEditorFormShell>
  );
};
