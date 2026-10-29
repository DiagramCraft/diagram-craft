import type { SchemaField, SchemaGroup } from '@arch-register/api-types/schemaContract';
import type { FieldType } from '../../lib/schemaPresentation';
import { FieldGroupsEditor } from './FieldGroupsEditor';
import { SchemaFieldRow } from './SchemaFieldRow';
import { useSchemaEditor } from './schemaEditorContext';

export const SchemaFieldsEditor = () => {
  const editor = useSchemaEditor<
    SchemaField,
    SchemaGroup,
    Record<never, never>,
    { id: string },
    FieldType
  >();
  const fields = editor.draft?.fields ?? [];

  return (
    <FieldGroupsEditor<SchemaField, SchemaGroup>
      renderField={(field, options, drag) => (
        <SchemaFieldRow
          field={field}
          onUpdate={patch => editor.updateField(field.id, patch)}
          onChangeType={type => editor.changeFieldType(field.id, type)}
          onRemove={options.canEdit ? () => editor.removeField(field.id) : undefined}
          containmentDisabled={fields.some(
            other => other.id !== field.id && other.type === 'containment'
          )}
          canEdit={options.canEdit}
          dragHandleRef={drag.ref}
        />
      )}
    />
  );
};
