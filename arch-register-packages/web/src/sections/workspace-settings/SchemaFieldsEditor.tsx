import type {
  EntitySchema,
  SchemaField,
  SchemaGroup,
  SharedFieldGroupLink
} from '@arch-register/api-types/schemaContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type { WorkspaceEnum } from '@arch-register/api-types/enumContract';
import { FieldGroupsEditor } from './FieldGroupsEditor';
import { SchemaFieldRow } from './SchemaFieldRow';
import type { FieldType } from '../../lib/schemaPresentation';

type Team = { id: string; name: string };

export const SchemaFieldsEditor = ({
  fields,
  groups,
  sharedFieldGroupLinks,
  fieldKeys,
  schemas,
  relationSchemas,
  enums,
  teams,
  canEdit,
  onAddField,
  onAddGroup,
  onUpdateField,
  onChangeFieldType,
  onRemoveField,
  onReorderField,
  onEditGroup,
  onAccessGroup,
  onRemoveGroup,
  onRemoveSharedGroup
}: {
  fields: SchemaField[];
  groups: SchemaGroup[];
  sharedFieldGroupLinks: SharedFieldGroupLink[];
  fieldKeys: ReadonlyMap<string, string>;
  schemas: EntitySchema[];
  relationSchemas: RelationSchema[];
  enums: WorkspaceEnum[];
  teams: Team[];
  canEdit: boolean;
  onAddField: (groupId?: string) => void;
  onAddGroup: () => void;
  onUpdateField: (fieldId: string, patch: Partial<SchemaField>) => void;
  onChangeFieldType: (fieldId: string, type: FieldType) => void;
  onRemoveField: (fieldId: string) => void;
  onReorderField: (bucketFieldIds: string[], fromIndex: number, toIndex: number) => void;
  onEditGroup: (group: SchemaGroup) => void;
  onAccessGroup: (groupId: string) => void;
  onRemoveGroup: (groupId: string) => void;
  onRemoveSharedGroup: (groupId: string) => void;
}) => {
  return (
    <FieldGroupsEditor<SchemaField, SchemaGroup>
      fields={fields}
      groups={groups}
      sharedFieldGroupLinks={sharedFieldGroupLinks}
      fieldKeys={fieldKeys}
      teams={teams}
      canEdit={canEdit}
      onAddField={onAddField}
      onAddGroup={onAddGroup}
      onEditGroup={onEditGroup}
      onAccessGroup={onAccessGroup}
      onRemoveGroup={onRemoveGroup}
      onRemoveSharedGroup={onRemoveSharedGroup}
      onReorderField={onReorderField}
      renderField={(field, options, drag) => (
        <SchemaFieldRow
          field={field}
          schemas={schemas}
          relationSchemas={relationSchemas}
          enums={enums}
          groups={groups}
          onUpdate={patch => onUpdateField(field.id, patch)}
          onChangeType={type => onChangeFieldType(field.id, type)}
          onRemove={options.canEdit ? () => onRemoveField(field.id) : undefined}
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
