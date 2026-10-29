import { useState } from 'react';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import { usePreviewSchemaValidation } from '../../hooks/useSchemas';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { useCanEditSchemas, useSchemaEditor } from './schemaEditorContext';
import { ValidationRulesEditor } from './ValidationRulesEditor';

/** Validation rules tab for relation types. */
export const RelationValidationTab = () => {
  const editor = useSchemaEditor();
  const canEdit = useCanEditSchemas();

  return (
    <ValidationRulesEditor
      variant="relation"
      rules={editor.draft?.validationRules ?? []}
      canEdit={canEdit}
      onAdd={editor.addValidationRule}
      onUpdate={editor.updateValidationRule}
      onToggle={editor.toggleValidationRule}
      onDelete={editor.deleteValidationRule}
    />
  );
};

/** Validation rules tab for entity types, including "Test rules" against existing entities. */
export const EntityValidationTab = () => {
  const editor = useSchemaEditor<never, never, Record<never, never>, EntitySchema>();
  const canEdit = useCanEditSchemas();
  const { workspaceSlug } = useWorkspaceContext();
  const previewValidation = usePreviewSchemaValidation(workspaceSlug);
  const [previewMessage, setPreviewMessage] = useState<string | null>(null);
  const { draft, selected } = editor;

  const preview = async () => {
    if (!selected || !draft) return;
    try {
      const results = await previewValidation.mutateAsync({
        schemaId: selected.id,
        validation_rules: draft.validationRules
      });
      const errors = results.reduce((count, result) => count + result.errors.length, 0);
      const warnings = results.reduce((count, result) => count + result.warnings.length, 0);
      setPreviewMessage(
        `Tested ${results.length} entities: ${errors} blocking error(s), ${warnings} warning(s).`
      );
    } catch (error) {
      setPreviewMessage(error instanceof Error ? error.message : 'Preview failed');
    }
  };

  return (
    <ValidationRulesEditor
      rules={draft?.validationRules ?? []}
      canEdit={canEdit}
      previewPending={previewValidation.isPending}
      previewMessage={previewMessage}
      onPreview={() => void preview()}
      onAdd={editor.addValidationRule}
      onUpdate={editor.updateValidationRule}
      onToggle={editor.toggleValidationRule}
      onDelete={editor.deleteValidationRule}
    />
  );
};
