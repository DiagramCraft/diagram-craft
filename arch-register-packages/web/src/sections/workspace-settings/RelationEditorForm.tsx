import { useState } from 'react';
import { Checkbox } from '@diagram-craft/app-components/Checkbox';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import type {
  RelationField,
  RelationSchema,
  RelationSchemaGroup
} from '@arch-register/api-types/relationSchemaContract';
import type { RelationEditorExtra } from './relationSchemaAdapter';
import { RelationEndpointEditor } from './RelationEndpointEditor';
import { RelationFieldsEditor } from './RelationFieldsEditor';
import { SchemaEditorFormShell } from './SchemaEditorFormShell';
import { useCanEditSchemas, useSchemaEditor } from './schemaEditorContext';
import { RelationValidationTab } from './ValidationTab';
import styles from './SchemaSettingsScreen.module.css';

/** Editor form for a relation type: endpoints and uniqueness on top of the shared form. */
export const RelationEditorForm = () => {
  const editor = useSchemaEditor<
    RelationField,
    RelationSchemaGroup,
    RelationEditorExtra,
    RelationSchema
  >();
  const canEdit = useCanEditSchemas();
  const [panelTab, setPanelTab] = useState('fields');
  const { draft } = editor;
  if (!draft) return null;

  return (
    <SchemaEditorFormShell
      descriptionPlaceholder="What does this relation type represent?"
      afterDescription={
        <>
          <div className={styles.formRow}>
            <RelationEndpointEditor
              label="In endpoint"
              endpoint={draft.inEndpoint}
              onChange={endpoint =>
                editor.updateDraft(current => ({ ...current, inEndpoint: endpoint }))
              }
            />
            <RelationEndpointEditor
              label="Out endpoint"
              endpoint={draft.outEndpoint}
              onChange={endpoint =>
                editor.updateDraft(current => ({ ...current, outEndpoint: endpoint }))
              }
            />
          </div>
          <div className={styles.formLabel} style={{ marginTop: '8px' }}>
            Uniqueness
          </div>
          <div style={{ fontSize: '12px', display: 'flex', alignItems: 'center' }}>
            <Checkbox
              label="Allow only one relation per ordered endpoint pair"
              value={draft.uniqueEndpointPair}
              disabled={!canEdit}
              onChange={value =>
                editor.updateDraft(current => ({ ...current, uniqueEndpointPair: value ?? false }))
              }
            />
          </div>
        </>
      }
    >
      <Tabs.Root value={panelTab} onValueChange={setPanelTab}>
        <Tabs.List aria-label="Relation editor sections">
          <Tabs.Trigger value="fields">Fields</Tabs.Trigger>
          <Tabs.Trigger value="validation">Validation</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="fields" style={{ height: 'auto' }}>
          <RelationFieldsEditor />
        </Tabs.Content>
        <Tabs.Content value="validation" style={{ height: 'auto' }}>
          <RelationValidationTab />
        </Tabs.Content>
      </Tabs.Root>
    </SchemaEditorFormShell>
  );
};
