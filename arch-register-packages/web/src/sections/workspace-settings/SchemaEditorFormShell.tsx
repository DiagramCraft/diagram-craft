import type { ReactNode } from 'react';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { SCHEMA_COLORS } from '@arch-register/api-types/colors';
import { ICON_MAP } from '../../components/TypeBadge';
import { SCHEMA_ICONS } from '../../lib/schemaPresentation';
import { CategorySelect } from './CategorySelect';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { useCanEditSchemas, useSchemaEditor } from './schemaEditorContext';
import type { EditorField, EditorGroup } from './schemaEditorState';
import styles from './SchemaSettingsScreen.module.css';

type CommonDraft = { categoryId: string | null };

/**
 * Name / category / description / appearance form shared by the schema editors. Reads the draft
 * from the surrounding `SchemaEditorProvider`; screens only add what is specific to them.
 */
export const SchemaEditorFormShell = ({
  descriptionPlaceholder,
  beforeDescription,
  afterDescription,
  onNameChange,
  children
}: {
  descriptionPlaceholder: string;
  beforeDescription?: ReactNode;
  afterDescription?: ReactNode;
  /** Overrides the default name edit, e.g. to derive other fields from the name. */
  onNameChange?: (value: string) => void;
  children: ReactNode;
}) => {
  const editor = useSchemaEditor<EditorField, EditorGroup, CommonDraft>();
  const canEdit = useCanEditSchemas();
  const { categories } = useWorkspaceContext();
  const { draft, updateDraft } = editor;
  if (!draft) return null;
  const { name, categoryId, description, color, icon } = draft;
  const setName = onNameChange ?? ((value: string) => updateDraft(d => ({ ...d, name: value })));
  const onCategoryChange = (value: string | null) =>
    updateDraft(d => ({ ...d, categoryId: value }));
  const onDescriptionChange = (value: string) => updateDraft(d => ({ ...d, description: value }));
  const onColorChange = (value: string) => updateDraft(d => ({ ...d, color: value }));
  const onIconChange = (value: string) => updateDraft(d => ({ ...d, icon: value }));

  return (
    <div className={styles.editor}>
      <div className={styles.formRow}>
        <div>
          <div className={styles.formLabel}>Name</div>
          <TextInput
            value={name}
            disabled={!canEdit}
            onChange={value => setName(value ?? '')}
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
