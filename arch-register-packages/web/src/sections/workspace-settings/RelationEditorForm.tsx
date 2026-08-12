import type {
  EntitySchema,
  SharedFieldGroupLink,
  ValidationRule
} from '@arch-register/api-types/schemaContract';
import type {
  RelationEndpoint,
  RelationField,
  RelationSchemaGroup
} from '@arch-register/api-types/relationSchemaContract';
import type { RelationFieldType } from '../../lib/schemaPresentation';
import { RelationEndpointEditor } from './RelationEndpointEditor';
import { RelationFieldsEditor } from './RelationFieldsEditor';
import { SchemaEditorFormShell } from './SchemaEditorFormShell';
import { ValidationRulesEditor } from './ValidationRulesEditor';
import styles from './SchemaSettingsScreen.module.css';

export const RelationEditorForm = ({
  name,
  category,
  description,
  inEndpoint,
  outEndpoint,
  color,
  icon,
  dirty,
  canEdit,
  updatePending,
  fields,
  groups,
  sharedFieldGroupLinks,
  fieldKeys,
  schemas,
  enums,
  teams,
  validationRules,
  onNameChange,
  onCategoryChange,
  onDescriptionChange,
  onInEndpointChange,
  onOutEndpointChange,
  onColorChange,
  onIconChange,
  onAddField,
  onAddGroup,
  onUpdateField,
  onChangeFieldType,
  onRemoveField,
  onEditGroup,
  onAccessGroup,
  onRemoveGroup,
  onRemoveSharedGroup,
  onAddValidationRule,
  onUpdateValidationRule,
  onToggleValidationRule,
  onDeleteValidationRule,
  onDelete,
  onSave
}: {
  name: string;
  category: string;
  description: string;
  inEndpoint: RelationEndpoint;
  outEndpoint: RelationEndpoint;
  color: string | null;
  icon: string | null;
  dirty: boolean;
  canEdit: boolean;
  updatePending: boolean;
  fields: RelationField[];
  groups: RelationSchemaGroup[];
  sharedFieldGroupLinks: SharedFieldGroupLink[];
  fieldKeys: ReadonlyMap<string, string>;
  schemas: EntitySchema[];
  enums: { id: string; name: string }[];
  teams: { id: string; name: string }[];
  validationRules: ValidationRule[];
  onNameChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onInEndpointChange: (endpoint: RelationEndpoint) => void;
  onOutEndpointChange: (endpoint: RelationEndpoint) => void;
  onColorChange: (value: string) => void;
  onIconChange: (value: string) => void;
  onAddField: (groupId?: string) => void;
  onAddGroup: () => void;
  onUpdateField: (fieldId: string, patch: Partial<RelationField>) => void;
  onChangeFieldType: (fieldId: string, type: RelationFieldType) => void;
  onRemoveField: (fieldId: string) => void;
  onEditGroup: (group: RelationSchemaGroup) => void;
  onAccessGroup: (groupId: string) => void;
  onRemoveGroup: (groupId: string) => void;
  onRemoveSharedGroup: (groupId: string) => void;
  onAddValidationRule: () => void;
  onUpdateValidationRule: (index: number, patch: Partial<ValidationRule>) => void;
  onToggleValidationRule: (index: number) => void;
  onDeleteValidationRule: (index: number) => void;
  onDelete: () => void;
  onSave: () => void;
}) => (
  <SchemaEditorFormShell
    name={name}
    category={category}
    description={description}
    color={color}
    icon={icon}
    dirty={dirty}
    canEdit={canEdit}
    updatePending={updatePending}
    descriptionPlaceholder="What does this relation type represent?"
    afterDescription={
      <div className={styles.formRow}>
        <RelationEndpointEditor
          label="In endpoint"
          hint="Entity types allowed at the 'in' end of this relation."
          endpoint={inEndpoint}
          schemas={schemas}
          canEdit={canEdit}
          onChange={onInEndpointChange}
        />
        <RelationEndpointEditor
          label="Out endpoint"
          hint="Entity types allowed at the 'out' end of this relation."
          endpoint={outEndpoint}
          schemas={schemas}
          canEdit={canEdit}
          onChange={onOutEndpointChange}
        />
      </div>
    }
    onNameChange={onNameChange}
    onCategoryChange={onCategoryChange}
    onDescriptionChange={onDescriptionChange}
    onColorChange={onColorChange}
    onIconChange={onIconChange}
    onDelete={onDelete}
    onSave={onSave}
  >
    <RelationFieldsEditor
      fields={fields}
      groups={groups}
      sharedFieldGroupLinks={sharedFieldGroupLinks}
      fieldKeys={fieldKeys}
      schemas={schemas}
      enums={enums}
      teams={teams}
      canEdit={canEdit}
      onAddField={onAddField}
      onAddGroup={onAddGroup}
      onUpdateField={onUpdateField}
      onChangeFieldType={onChangeFieldType}
      onRemoveField={onRemoveField}
      onEditGroup={onEditGroup}
      onAccessGroup={onAccessGroup}
      onRemoveGroup={onRemoveGroup}
      onRemoveSharedGroup={onRemoveSharedGroup}
    />
    <ValidationRulesEditor
      variant="relation"
      rules={validationRules}
      canEdit={canEdit}
      onAdd={onAddValidationRule}
      onUpdate={onUpdateValidationRule}
      onToggle={onToggleValidationRule}
      onDelete={onDeleteValidationRule}
    />
  </SchemaEditorFormShell>
);
