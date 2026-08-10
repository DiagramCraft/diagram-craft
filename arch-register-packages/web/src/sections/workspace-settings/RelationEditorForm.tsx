import { Button } from '@diagram-craft/app-components/Button';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { TbTrash } from 'react-icons/tb';
import type { EntitySchema, SharedFieldGroupLink, ValidationRule } from '@arch-register/api-types/schemaContract';
import type { RelationEndpoint, RelationField, RelationSchemaGroup } from '@arch-register/api-types/relationSchemaContract';
import { SCHEMA_COLORS } from '@arch-register/api-types/colors';
import { ICON_MAP } from '../../components/TypeBadge';
import { SCHEMA_ICONS } from '../../lib/schemaPresentation';
import type { RelationFieldType } from '../../lib/schemaPresentation';
import { RelationEndpointEditor } from './RelationEndpointEditor';
import { RelationFieldsEditor, RelationValidationEditor } from './RelationFieldsEditor';
import styles from './SchemaSettingsScreen.module.css';

export const RelationEditorForm = ({
  name,
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
  <div className={styles.editor}>
    <div className={styles.formRow}>
      <div>
        <div className={styles.formLabel}>Name</div>
        <TextInput value={name} disabled={!canEdit} onChange={value => onNameChange(value ?? '')} style={{ width: '100%' }} />
      </div>
    </div>
    <div className={styles.formRow}>
      <div>
        <div className={styles.formLabel}>Description</div>
        <TextArea
          value={description}
          disabled={!canEdit}
          placeholder="What does this relation type represent?"
          onChange={value => onDescriptionChange(value ?? '')}
          rows={4}
          style={{ width: '100%' }}
        />
      </div>
    </div>
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
    <RelationValidationEditor
      rules={validationRules}
      canEdit={canEdit}
      onAdd={onAddValidationRule}
      onUpdate={onUpdateValidationRule}
      onToggle={onToggleValidationRule}
      onDelete={onDeleteValidationRule}
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
