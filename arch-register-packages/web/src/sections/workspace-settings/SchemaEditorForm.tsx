import type {
  EntitySchema,
  EntityTemplate,
  SchemaField,
  SchemaGroup,
  SharedFieldGroupLink,
  ValidationRule
} from '@arch-register/api-types/schemaContract';
import type { EntityCapability } from '@arch-register/api-types/entityCapabilityContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type { WorkspaceEnum } from '@arch-register/api-types/enumContract';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import type { FieldType } from '../../lib/schemaPresentation';
import { SchemaEditorFormShell } from './SchemaEditorFormShell';
import { SchemaEditorTabs, type SchemaPanelTab } from './SchemaEditorTabs';
import styles from './SchemaSettingsScreen.module.css';

export const SchemaEditorForm = ({
  name,
  keyPrefix,
  description,
  color,
  icon,
  dirty,
  canEdit,
  updatePending,
  panelTab,
  fields,
  groups,
  sharedFieldGroupLinks,
  fieldKeys,
  schemas,
  relationSchemas,
  enums,
  teams,
  templates,
  entityCapabilities,
  validationRules,
  validationPreviewPending,
  validationPreviewMessage,
  onNameChange,
  onKeyPrefixChange,
  onDescriptionChange,
  onColorChange,
  onIconChange,
  onPanelTabChange,
  onAddField,
  onAddGroup,
  onUpdateField,
  onChangeFieldType,
  onRemoveField,
  onEditGroup,
  onAccessGroup,
  onRemoveGroup,
  onRemoveSharedGroup,
  onAddTemplate,
  onEditTemplate,
  onDeleteTemplate,
  onAddEntityCapability,
  onUpdateEntityCapability,
  onDeleteEntityCapability,
  onPreviewValidation,
  onAddValidationRule,
  onUpdateValidationRule,
  onToggleValidationRule,
  onDeleteValidationRule,
  onDelete,
  onSave
}: {
  name: string;
  keyPrefix: string;
  description: string;
  color: string | null;
  icon: string | null;
  dirty: boolean;
  canEdit: boolean;
  updatePending: boolean;
  panelTab: SchemaPanelTab;
  fields: SchemaField[];
  groups: SchemaGroup[];
  sharedFieldGroupLinks: SharedFieldGroupLink[];
  fieldKeys: ReadonlyMap<string, string>;
  schemas: EntitySchema[];
  relationSchemas: RelationSchema[];
  enums: WorkspaceEnum[];
  teams: { id: string; name: string }[];
  templates: EntityTemplate[];
  entityCapabilities: EntityCapability[];
  validationRules: ValidationRule[];
  validationPreviewPending: boolean;
  validationPreviewMessage: string | null;
  onNameChange: (value: string) => void;
  onKeyPrefixChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onColorChange: (value: string) => void;
  onIconChange: (value: string) => void;
  onPanelTabChange: (value: SchemaPanelTab) => void;
  onAddField: (groupId?: string) => void;
  onAddGroup: () => void;
  onUpdateField: (fieldId: string, patch: Partial<SchemaField>) => void;
  onChangeFieldType: (fieldId: string, type: FieldType) => void;
  onRemoveField: (fieldId: string) => void;
  onEditGroup: (group: SchemaGroup) => void;
  onAccessGroup: (groupId: string) => void;
  onRemoveGroup: (groupId: string) => void;
  onRemoveSharedGroup: (groupId: string) => void;
  onAddTemplate: () => void;
  onEditTemplate: (template: EntityTemplate) => void;
  onDeleteTemplate: (templateId: string) => void;
  onAddEntityCapability: (type: string) => void;
  onUpdateEntityCapability: (index: number, patch: Partial<EntityCapability>) => void;
  onDeleteEntityCapability: (index: number) => void;
  onPreviewValidation: () => void;
  onAddValidationRule: () => void;
  onUpdateValidationRule: (index: number, patch: Partial<ValidationRule>) => void;
  onToggleValidationRule: (index: number) => void;
  onDeleteValidationRule: (index: number) => void;
  onDelete: () => void;
  onSave: () => void;
}) => (
  <SchemaEditorFormShell
    name={name}
    description={description}
    color={color}
    icon={icon}
    dirty={dirty}
    canEdit={canEdit}
    updatePending={updatePending}
    descriptionPlaceholder="What does this entity type represent?"
    beforeDescription={
      <div className={styles.formRow}>
        <div>
          <div className={styles.formLabel}>Key Prefix</div>
          <TextInput
            value={keyPrefix}
            disabled={!canEdit}
            onChange={value => onKeyPrefixChange(value ?? '')}
            style={{ width: '100%' }}
          />
        </div>
      </div>
    }
    onNameChange={onNameChange}
    onDescriptionChange={onDescriptionChange}
    onColorChange={onColorChange}
    onIconChange={onIconChange}
    onDelete={onDelete}
    onSave={onSave}
  >
    <SchemaEditorTabs
      activeTab={panelTab}
      onTabChange={onPanelTabChange}
      fields={fields}
      groups={groups}
      sharedFieldGroupLinks={sharedFieldGroupLinks}
      fieldKeys={fieldKeys}
      schemas={schemas}
      relationSchemas={relationSchemas}
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
      templates={templates}
      entityCapabilities={entityCapabilities}
      onAddTemplate={onAddTemplate}
      onEditTemplate={onEditTemplate}
      onDeleteTemplate={onDeleteTemplate}
      onAddEntityCapability={onAddEntityCapability}
      onUpdateEntityCapability={onUpdateEntityCapability}
      onDeleteEntityCapability={onDeleteEntityCapability}
      validationRules={validationRules}
      validationPreviewPending={validationPreviewPending}
      validationPreviewMessage={validationPreviewMessage}
      onPreviewValidation={onPreviewValidation}
      onAddValidationRule={onAddValidationRule}
      onUpdateValidationRule={onUpdateValidationRule}
      onToggleValidationRule={onToggleValidationRule}
      onDeleteValidationRule={onDeleteValidationRule}
    />
  </SchemaEditorFormShell>
);
