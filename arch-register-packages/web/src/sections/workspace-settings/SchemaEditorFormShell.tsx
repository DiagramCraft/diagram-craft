import type { ReactNode } from 'react';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { ColorPicker } from '../../components/ColorPicker';
import { IconPicker } from '../../components/IconPicker';
import { Panel } from '../../components/Panel';
import { Stack } from '../../components/Stack';
import { CategorySelect } from './CategorySelect';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { useCanEditSchemas, useSchemaEditor } from './schemaEditorContext';
import type { EditorField, EditorGroup } from './schemaEditorState';
import styles from './SchemaSettingsScreen.module.css';
import { FormElement } from '@diagram-craft/app-components/FormElement';
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
    <Panel>
      <Stack>
        <FormElement label={'Name'}>
          <TextInput
            value={name}
            disabled={!canEdit}
            onChange={value => setName(value ?? '')}
            style={{ width: '100%' }}
          />
        </FormElement>

        {beforeDescription}

        <FormElement label={'Category'}>
          <CategorySelect
            value={categoryId}
            categories={categories}
            disabled={!canEdit}
            onChange={onCategoryChange}
          />
        </FormElement>

        <FormElement label={'Description'}>
          <TextArea
            value={description}
            disabled={!canEdit}
            placeholder={descriptionPlaceholder}
            onChange={value => onDescriptionChange(value ?? '')}
            rows={4}
            style={{ width: '100%' }}
          />
        </FormElement>

        {afterDescription}

        <div className={styles.appearanceRow}>
          <FormElement label={'Color'}>
            <ColorPicker
              size="small"
              value={color}
              disabled={!canEdit}
              onChange={c => c && onColorChange(c)}
            />
          </FormElement>

          <FormElement label={'Icon'}>
            <IconPicker
              value={icon ?? undefined}
              disabled={!canEdit}
              onChange={value => value && onIconChange(value)}
            />
          </FormElement>
        </div>
        {children}
      </Stack>
    </Panel>
  );
};
