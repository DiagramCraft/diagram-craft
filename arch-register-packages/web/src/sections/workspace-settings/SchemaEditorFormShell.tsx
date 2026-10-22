import type { ReactNode } from 'react';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { SCHEMA_COLORS } from '@arch-register/api-types/colors';
import { ICON_MAP } from '../../components/TypeBadge';
import { SCHEMA_ICONS } from '../../lib/schemaPresentation';
import { CategorySelect } from './CategorySelect';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import styles from './SchemaSettingsScreen.module.css';

export const SchemaEditorFormShell = ({
  name,
  categoryId,
  description,
  color,
  icon,
  canEdit,
  descriptionPlaceholder,
  beforeDescription,
  afterDescription,
  children,
  onNameChange,
  onCategoryChange,
  onDescriptionChange,
  onColorChange,
  onIconChange
}: {
  name: string;
  categoryId: string | null;
  description: string;
  color: string | null;
  icon: string | null;
  canEdit: boolean;
  descriptionPlaceholder: string;
  beforeDescription?: ReactNode;
  afterDescription?: ReactNode;
  children: ReactNode;
  onNameChange: (value: string) => void;
  onCategoryChange: (value: string | null) => void;
  onDescriptionChange: (value: string) => void;
  onColorChange: (value: string) => void;
  onIconChange: (value: string) => void;
}) => {
  const { categories } = useWorkspaceContext();
  return (
    <div className={styles.editor}>
      <div className={styles.formRow}>
        <div>
          <div className={styles.formLabel}>Name</div>
          <TextInput
            value={name}
            disabled={!canEdit}
            onChange={value => onNameChange(value ?? '')}
            style={{ width: '100%' }}
          />
        </div>
      </div>
      {beforeDescription}
      <div className={styles.formRow}>
        <div>
          <div className={styles.formLabel}>Category</div>
          <CategorySelect
            value={categoryId}
            categories={categories}
            disabled={!canEdit}
            onChange={onCategoryChange}
          />
        </div>
      </div>
      <div className={styles.formRow}>
        <div>
          <div className={styles.formLabel}>Description</div>
          <TextArea
            value={description}
            disabled={!canEdit}
            placeholder={descriptionPlaceholder}
            onChange={value => onDescriptionChange(value ?? '')}
            rows={4}
            style={{ width: '100%' }}
          />
        </div>
      </div>
      {afterDescription}
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
      {children}
    </div>
  );
};
