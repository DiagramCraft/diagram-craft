import { useEffect, useState } from 'react';
import type {
  AssessmentEnumOption,
  AssessmentField
} from '@arch-register/api-types/assessmentContract';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { ListEditor } from '../../../components/ListEditor';
import { DerivedExpressionTestDialog } from '../../../components/DerivedExpressionTestDialog';
import styles from './assessment-editor-shared.module.css';

type InlineEnumField = Extract<AssessmentField, { type: 'enum'; options: AssessmentEnumOption[] }>;
type DerivedField = Extract<AssessmentField, { type: 'derived' }>;

export const AssessmentDerivedExpressionDialog = ({
  open,
  field,
  onClose,
  onSave
}: {
  open: boolean;
  field: DerivedField;
  onClose: () => void;
  onSave: (expression: string) => void;
}) => (
  <DerivedExpressionTestDialog
    open={open}
    field={field}
    expression={field.expression}
    root="assessment"
    onClose={onClose}
    onSave={onSave}
  />
);

export const AssessmentInlineEnumDialog = ({
  open,
  field,
  onClose,
  onSave
}: {
  open: boolean;
  field: InlineEnumField;
  onClose: () => void;
  onSave: (options: AssessmentEnumOption[]) => void;
}) => {
  const [draftOptions, setDraftOptions] = useState<AssessmentEnumOption[]>([]);

  useEffect(() => {
    if (open) setDraftOptions(field.options.map(option => ({ ...option })));
  }, [field.options, open]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Edit values: ${field.label || 'Select field'}`}
      width={520}
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: onClose },
        {
          label: 'Save values',
          type: 'default',
          onClick: () => {
            onSave(draftOptions);
            onClose();
          }
        }
      ]}
    >
      <ListEditor
        items={draftOptions}
        onChange={setDraftOptions}
        createItem={() => ({ value: `option_${draftOptions.length + 1}`, label: '' })}
        addLabel="Add option"
        reorder="drag"
        removeLabel="Remove option"
        renderItem={(option, { update }) => (
          <div className={styles.inlineEnumDialogOption}>
            <TextInput
              value={option.value}
              onChange={value => update({ value: value ?? '' })}
              placeholder="Value"
            />
            <TextInput
              value={option.label}
              onChange={value => update({ label: value ?? '' })}
              placeholder="Label"
            />
          </div>
        )}
      />
    </Dialog>
  );
};
