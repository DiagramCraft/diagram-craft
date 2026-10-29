import { Dialog } from '@diagram-craft/app-components/Dialog';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { Select } from '@diagram-craft/app-components/Select';
import { assessmentTemplates } from '../../../lib/assessmentTemplates';
import { START_FROM_SCRATCH, type AssessmentEditorController } from './assessmentEditorState';

export const AssessmentTemplateControls = ({ editor }: { editor: AssessmentEditorController }) => {
  if (!editor.isNew) return null;

  const { actions } = editor;
  return (
    <>
      <FormElement label="Start from template" required={false}>
        <Select.Root value={editor.selectedTemplateId} onChange={actions.selectTemplate}>
          <Select.Item value={START_FROM_SCRATCH}>Start from scratch</Select.Item>
          {assessmentTemplates.map(template => (
            <Select.Item key={template.id} value={template.id}>
              {template.label}
            </Select.Item>
          ))}
        </Select.Root>
      </FormElement>
      <Dialog
        open={editor.pendingTemplateId !== null}
        onClose={actions.cancelPendingTemplate}
        title="Replace assessment template?"
        width={420}
        buttons={[
          { label: 'Cancel', type: 'cancel', onClick: actions.cancelPendingTemplate },
          {
            label: 'Replace values',
            type: 'default',
            onClick: actions.applyPendingTemplate
          }
        ]}
      >
        <p>
          Your current assessment values will be replaced by the selected template. This cannot be
          undone.
        </p>
      </Dialog>
    </>
  );
};
