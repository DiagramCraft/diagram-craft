import { useEffect, useState } from 'react';
import { TbPlus, TbTrash } from 'react-icons/tb';
import type {
  AssessmentEnumOption,
  AssessmentField
} from '@arch-register/api-types/assessmentContract';
import { Button } from '@diagram-craft/app-components/Button';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { DerivedExpressionTestDialog } from '../../../components/DerivedExpressionTestDialog';
import styles from '../ProjectAssessments.module.css';

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
      <div className={styles.inlineEnumDialogOptions}>
        {draftOptions.map((option, index) => (
          <div key={`${option.value}-${index}`} className={styles.inlineEnumDialogOption}>
            <TextInput
              value={option.value}
              onChange={value =>
                setDraftOptions(current =>
                  current.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, value: value ?? '' } : item
                  )
                )
              }
              placeholder="Value"
            />
            <TextInput
              value={option.label}
              onChange={value =>
                setDraftOptions(current =>
                  current.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, label: value ?? '' } : item
                  )
                )
              }
              placeholder="Label"
            />
            <Button
              variant="ghost"
              icon={<TbTrash size={13} />}
              onClick={() =>
                setDraftOptions(current => current.filter((_, itemIndex) => itemIndex !== index))
              }
              title="Remove option"
            />
          </div>
        ))}
        <Button
          variant="ghost"
          icon={<TbPlus size={13} />}
          onClick={() =>
            setDraftOptions(current => [
              ...current,
              { value: `option_${current.length + 1}`, label: '' }
            ])
          }
        >
          Add option
        </Button>
      </div>
    </Dialog>
  );
};
