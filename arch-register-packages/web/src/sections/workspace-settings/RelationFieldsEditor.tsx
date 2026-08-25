import type { EntitySchema, SharedFieldGroupLink } from '@arch-register/api-types/schemaContract';
import type {
  RelationField,
  RelationSchemaGroup
} from '@arch-register/api-types/relationSchemaContract';
import type { RelationFieldType } from '../../lib/schemaPresentation';
import { FieldGroupsEditor } from './FieldGroupsEditor';
import { RelationFieldRow } from './RelationFieldRow';

type RelationFieldsEditorProps = {
  fields: RelationField[];
  groups: RelationSchemaGroup[];
  sharedFieldGroupLinks: SharedFieldGroupLink[];
  fieldKeys: ReadonlyMap<string, string>;
  schemas: EntitySchema[];
  enums: { id: string; name: string }[];
  teams: { id: string; name: string }[];
  canEdit: boolean;
  onAddField: (groupId?: string) => void;
  onAddGroup: () => void;
  onUpdateField: (fieldId: string, patch: Partial<RelationField>) => void;
  onChangeFieldType: (fieldId: string, type: RelationFieldType) => void;
  onRemoveField: (fieldId: string) => void;
  onReorderField: (bucketFieldIds: string[], fromIndex: number, toIndex: number) => void;
  onEditGroup: (group: RelationSchemaGroup) => void;
  onAccessGroup: (groupId: string) => void;
  onRemoveGroup: (groupId: string) => void;
  onRemoveSharedGroup: (groupId: string) => void;
};

export const RelationFieldsEditor = ({
  fields,
  groups,
  sharedFieldGroupLinks,
  fieldKeys,
  schemas,
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
}: RelationFieldsEditorProps) => (
  <FieldGroupsEditor<RelationField, RelationSchemaGroup>
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
      <RelationFieldRow
        field={field}
        schemas={schemas}
        enums={enums}
        groups={groups}
        onUpdate={patch => onUpdateField(field.id, patch)}
        onChangeType={type => onChangeFieldType(field.id, type)}
        onRemove={options.canEdit ? () => onRemoveField(field.id) : undefined}
        canEdit={options.canEdit}
        dragHandleRef={drag.ref}
      />
    )}
  />
);
