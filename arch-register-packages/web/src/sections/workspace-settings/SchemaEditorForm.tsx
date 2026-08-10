import { Button } from '@diagram-craft/app-components/Button';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { TbTrash } from 'react-icons/tb';
import type { EntitySchema, EntityTemplate, SchemaField, SchemaGroup, SharedFieldGroupLink, ValidationRule } from '@arch-register/api-types/schemaContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type { WorkspaceEnum } from '@arch-register/api-types/enumContract';
import { SCHEMA_COLORS } from '@arch-register/api-types/colors';
import { ICON_MAP } from '../../components/TypeBadge';
import { SCHEMA_ICONS } from '../../lib/schemaPresentation';
import type { FieldType } from '../../lib/schemaPresentation';
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
  onPreviewValidation: () => void;
  onAddValidationRule: () => void;
  onUpdateValidationRule: (index: number, patch: Partial<ValidationRule>) => void;
  onToggleValidationRule: (index: number) => void;
  onDeleteValidationRule: (index: number) => void;
  onDelete: () => void;
  onSave: () => void;
}) => (
  <div className={styles.editor}>
    <div className={styles.formRow}>
      <div>
        <div className={styles.formLabel}>Name</div>
        <TextInput value={name} disabled={!canEdit} onChange={value => onNameChange(value ?? '')} style={{ width: '100%' }} />
      </div>
    </div>
    <div className={styles.formRow}>
      <div>
        <div className={styles.formLabel}>Key Prefix</div>
        <TextInput value={keyPrefix} disabled={!canEdit} onChange={value => onKeyPrefixChange(value ?? '')} style={{ width: '100%' }} />
      </div>
    </div>
    <div className={styles.formRow}>
      <div>
        <div className={styles.formLabel}>Description</div>
        <TextArea
          value={description}
          disabled={!canEdit}
          placeholder="What does this entity type represent?"
          onChange={value => onDescriptionChange(value ?? '')}
          rows={4}
          style={{ width: '100%' }}
        />
      </div>
    </div>
    <div className={styles.appearanceRow}>
      <div>
        <div className={styles.formLabel}>Color</div>
        <div className={styles.colorSwatches}>
          {SCHEMA_COLORS.map(option => (
            <button
              type="button"
              key={option}
              className={`${styles.swatch} ${color === option ? styles.swatchActive : ''}`}
              style={{ background: option }}
              disabled={!canEdit}
              onClick={() => onColorChange(option)}
            />
          ))}
        </div>
      </div>
      <div>
        <div className={styles.formLabel}>Icon</div>
        <div className={styles.iconPicker}>
          {SCHEMA_ICONS.map(id => {
            const Icon = ICON_MAP[id];
            return (
              <button
                type="button"
                key={id}
                className={`${styles.iconOption} ${icon === id ? styles.iconOptionActive : ''}`}
                title={id}
                disabled={!canEdit}
                onClick={() => onIconChange(id)}
              >
                <Icon size={14} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
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
    />
    <div className={styles.formActions}>
      {canEdit && (
        <Button variant="danger" icon={<TbTrash size={12} />} onClick={onDelete}>
          Delete type
        </Button>
      )}
      <div style={{ flex: 1 }} />
      {canEdit && dirty && (
        <Button variant="primary" onClick={onSave} disabled={updatePending}>
          {updatePending ? 'Saving...' : 'Save'}
        </Button>
      )}
    </div>
  </div>
);
