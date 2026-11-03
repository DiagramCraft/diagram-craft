import { Dialog } from '@diagram-craft/app-components/Dialog';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { Select } from '@diagram-craft/app-components/Select';
import styles from './MarkdownChangeImpactDialog.module.css';
import type { GovernanceInitiationField } from '@arch-register/api-types/governanceInitiationFields';
import { GovernanceInitiationFields } from '../governance/GovernanceInitiationFields';

export type MarkdownSaveIntent = 'save' | 'save-and-close';

export const MarkdownChangeImpactDialog = ({
  open,
  intent,
  changeKind,
  onChangeKind,
  onCancel,
  onConfirm,
  initiationFields = [],
  initiationFieldValues = {},
  onInitiationFieldValuesChange = () => undefined
}: {
  open: boolean;
  intent: MarkdownSaveIntent | null;
  changeKind: 'minor' | 'major';
  onChangeKind: (changeKind: 'minor' | 'major') => void;
  onCancel: () => void;
  onConfirm: () => void;
  initiationFields?: GovernanceInitiationField[];
  initiationFieldValues?: Record<string, unknown>;
  onInitiationFieldValuesChange?: (values: Record<string, unknown>) => void;
}) => (
  <Dialog
    open={open}
    onClose={onCancel}
    title="Choose change impact"
    width={440}
    buttons={[
      { label: 'Cancel', type: 'cancel', onClick: onCancel },
      {
        label: intent === 'save-and-close' ? 'Save & Close' : 'Save',
        type: 'default',
        onClick: onConfirm
      }
    ]}
  >
    <div className={styles.body}>
      <p className={styles.description}>
        Choose how this change should affect the document workflow.
      </p>
      <FormElement label="Change impact">
        <Select.Root
          value={changeKind}
          onChange={value => onChangeKind((value ?? 'minor') as 'minor' | 'major')}
        >
          <Select.Item value="minor">Minor — preserve pending approval</Select.Item>
          <Select.Item value="major">Major — request target approval</Select.Item>
        </Select.Root>
      </FormElement>
      <GovernanceInitiationFields
        fields={initiationFields}
        values={initiationFieldValues}
        onChange={onInitiationFieldValuesChange}
      />
    </div>
  </Dialog>
);
