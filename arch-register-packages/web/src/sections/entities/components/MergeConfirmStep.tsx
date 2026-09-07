import { Banner } from '../../../components/Banner';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import type { MergePreview } from '@arch-register/api-types/entityMergeContract';
import styles from './MergeWizardDialog.module.css';

type Props = {
  preview: MergePreview;
  sourceEntityName: string;
  targetEntityName: string;
  confirmText: string;
  onConfirmTextChange: (value: string) => void;
  executeError: string | null;
  onRefreshAfterConflict: () => void;
};

export const MergeConfirmStep = ({
  preview,
  sourceEntityName,
  targetEntityName,
  confirmText,
  onConfirmTextChange,
  executeError,
  onRefreshAfterConflict
}: Props) => {
  const fieldChangeCount = preview.fieldConflicts.length;
  const relationChangeCount = preview.relationConflicts.length;
  const sideTableChangeCount = preview.sideTableConflicts.length;

  return (
    <div className={styles.section}>
      <p>
        <b>{sourceEntityName}</b> will be merged into <b>{targetEntityName}</b> and retired. Old
        links to {sourceEntityName} will keep resolving to {targetEntityName}. This can't be
        undone.
      </p>
      <ul className={styles.fixedNote}>
        <li>{fieldChangeCount} field conflict(s) resolved</li>
        <li>{relationChangeCount} relation conflict(s) resolved</li>
        <li>{sideTableChangeCount} other conflict(s) resolved</li>
      </ul>
      {executeError && (
        <Banner
          variant="error"
          action={
            <button type="button" onClick={onRefreshAfterConflict}>
              Refresh and re-review
            </button>
          }
        >
          {executeError}
        </Banner>
      )}
      <FormElement label={`Type "${sourceEntityName}" to confirm`} required>
        <TextInput
          placeholder={sourceEntityName}
          value={confirmText}
          onChange={value => onConfirmTextChange(value ?? '')}
          style={{ maxWidth: 320, fontFamily: 'var(--mono)' }}
        />
      </FormElement>
    </div>
  );
};
