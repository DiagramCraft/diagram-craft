import type {
  RelationField,
  RelationSchemaGroup
} from '@arch-register/api-types/relationSchemaContract';
import type { RelationFieldType } from '../../lib/schemaPresentation';
import { FieldGroupsEditor } from './FieldGroupsEditor';
import { RelationFieldRow } from './RelationFieldRow';
import { useSchemaEditor } from './schemaEditorContext';

export const RelationFieldsEditor = () => {
  const editor = useSchemaEditor<
    RelationField,
    RelationSchemaGroup,
    Record<never, never>,
    { id: string },
    RelationFieldType
  >();

  return (
    <FieldGroupsEditor<RelationField, RelationSchemaGroup>
      renderField={(field, options, drag) => (
        <RelationFieldRow
          field={field}
          onUpdate={patch => editor.updateField(field.id, patch)}
          onChangeType={type => editor.changeFieldType(field.id, type)}
          onRemove={options.canEdit ? () => editor.removeField(field.id) : undefined}
          canEdit={options.canEdit}
          dragHandleRef={drag.ref}
        />
      )}
    />
  );
};
