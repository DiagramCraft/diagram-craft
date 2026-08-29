import type {
  DetailLayoutConfig,
  EntitySchema,
  EntityTemplate,
  SchemaField,
  SchemaGroup,
  SharedFieldGroupLink,
  ValidationRule
} from '@arch-register/api-types/schemaContract';
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
  categoryId,
  description,
  color,
  icon,
  dirty,
  canEdit,
  updatePending,
  saveBlocked,
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
  validationRules,
  validationPreviewPending,
  validationPreviewMessage,
  onNameChange,
  onKeyPrefixChange,
  onCategoryChange,
  onDescriptionChange,
  onColorChange,
  onIconChange,
  onPanelTabChange,
  onAddField,
  onAddGroup,
  onUpdateField,
  onChangeFieldType,
  onRemoveField,
  onReorderField,
  onEditGroup,
  onAccessGroup,
  onRemoveGroup,
  onRemoveSharedGroup,
  onAddTemplate,
  onEditTemplate,
  onDeleteTemplate,
  onPreviewValidation,
  onAddValidationRule,
  onUpdateValidationRule,
  onToggleValidationRule,
  onDeleteValidationRule,
  detailLayoutEnabled,
  onToggleDetailLayoutEnabled,
  detailLayout,
  onDetailLayoutChange,
  onDelete,
  onSave
}: {
  name: string;
  keyPrefix: string;
  categoryId: string | null;
  description: string;
  color: string | null;
  icon: string | null;
  dirty: boolean;
  canEdit: boolean;
  updatePending: boolean;
  saveBlocked?: boolean;
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
  validationRules: ValidationRule[];
  validationPreviewPending: boolean;
  validationPreviewMessage: string | null;
  onNameChange: (value: string) => void;
  onKeyPrefixChange: (value: string) => void;
  onCategoryChange: (value: string | null) => void;
  onDescriptionChange: (value: string) => void;
  onColorChange: (value: string) => void;
  onIconChange: (value: string) => void;
  onPanelTabChange: (value: SchemaPanelTab) => void;
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
  onAddTemplate: () => void;
  onEditTemplate: (template: EntityTemplate) => void;
  onDeleteTemplate: (templateId: string) => void;
  onPreviewValidation: () => void;
  onAddValidationRule: () => void;
  onUpdateValidationRule: (index: number, patch: Partial<ValidationRule>) => void;
  onToggleValidationRule: (index: number) => void;
  onDeleteValidationRule: (index: number) => void;
  detailLayoutEnabled: boolean;
  onToggleDetailLayoutEnabled: (enabled: boolean) => void;
  detailLayout: DetailLayoutConfig;
  onDetailLayoutChange: (layout: DetailLayoutConfig) => void;
  onDelete?: () => void;
  onSave: () => void;
}) => (
  <SchemaEditorFormShell
    name={name}
    categoryId={categoryId}
    description={description}
    color={color}
    icon={icon}
    dirty={dirty}
    canEdit={canEdit}
    updatePending={updatePending}
    saveBlocked={saveBlocked}
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
    onCategoryChange={onCategoryChange}
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
      onReorderField={onReorderField}
      onEditGroup={onEditGroup}
      onAccessGroup={onAccessGroup}
      onRemoveGroup={onRemoveGroup}
      onRemoveSharedGroup={onRemoveSharedGroup}
      templates={templates}
      onAddTemplate={onAddTemplate}
      onEditTemplate={onEditTemplate}
      onDeleteTemplate={onDeleteTemplate}
      validationRules={validationRules}
      validationPreviewPending={validationPreviewPending}
      validationPreviewMessage={validationPreviewMessage}
      onPreviewValidation={onPreviewValidation}
      onAddValidationRule={onAddValidationRule}
      onUpdateValidationRule={onUpdateValidationRule}
      onToggleValidationRule={onToggleValidationRule}
      onDeleteValidationRule={onDeleteValidationRule}
      detailLayoutEnabled={detailLayoutEnabled}
      onToggleDetailLayoutEnabled={onToggleDetailLayoutEnabled}
      detailLayout={detailLayout}
      onDetailLayoutChange={onDetailLayoutChange}
    />
  </SchemaEditorFormShell>
);
