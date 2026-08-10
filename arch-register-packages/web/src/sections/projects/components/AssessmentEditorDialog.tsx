import { Dialog } from '@diagram-craft/app-components/Dialog';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import type { Assessment } from '@arch-register/api-types/assessmentContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import { AssessmentEditorTabs } from './AssessmentEditorTabs';
import { AssessmentTemplateControls } from './AssessmentTemplateControls';
import { buildAssessmentFormData, useAssessmentEditorController } from './assessmentEditorState';
import type { AssessmentFormData } from './assessmentEditorState';
import styles from '../ProjectAssessments.module.css';

export type { AssessmentFormData } from './assessmentEditorState';

export const AssessmentEditorDialog = ({
  assessment,
  schemas,
  isSaving,
  onSave,
  onCancel
}: {
  assessment: Assessment | null;
  schemas: EntitySchema[];
  isSaving: boolean;
  onSave: (data: AssessmentFormData, status: Assessment['status']) => void;
  onCancel: () => void;
}) => {
  const editor = useAssessmentEditorController({ assessment, schemas });

  return (
    <Dialog
      open
      onClose={onCancel}
      title={editor.isNew ? 'New assessment' : 'Edit assessment'}
      width={900}
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: onCancel },
        {
          label: isSaving ? 'Saving...' : editor.isNew ? 'Create assessment' : 'Save changes',
          type: 'default',
          disabled: !editor.canSave || isSaving,
          onClick: () => onSave(buildAssessmentFormData(editor.draft), editor.draft.status)
        }
      ]}
    >
      <div className={styles.editorTopSection}>
        <div className={styles.editorTopRow}>
          <FormElement label="Name" required>
            <TextInput
              value={editor.draft.name}
              onChange={value => editor.actions.onNameChange(value ?? '')}
              placeholder="e.g. Security Readiness"
              style={{ width: '100%' }}
            />
          </FormElement>
          <AssessmentTemplateControls editor={editor} />
        </div>
      </div>
      <AssessmentEditorTabs editor={editor} schemas={schemas} />
    </Dialog>
  );
};
