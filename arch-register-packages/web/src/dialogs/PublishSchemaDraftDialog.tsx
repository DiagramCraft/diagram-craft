import { useEffect, useState } from 'react';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { Banner } from '../components/Banner';

export const PublishSchemaDraftDialog = ({
  open,
  pending,
  error,
  onCancel,
  onConfirm
}: {
  open: boolean;
  pending: boolean;
  error?: string;
  onCancel: () => void;
  onConfirm: (summary: string) => void;
}) => {
  const [summary, setSummary] = useState('');

  useEffect(() => {
    if (open) setSummary('');
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title="Publish schema draft"
      width={480}
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: onCancel },
        {
          label: 'Publish',
          type: 'default',
          disabled: pending || summary.trim() === '',
          onClick: () => onConfirm(summary.trim())
        }
      ]}
    >
      <div style={{ display: 'grid', gap: 12 }}>
        {error && <Banner variant="error">{error}</Banner>}
        <FormElement label="Description">
          <TextArea
            value={summary}
            placeholder="What does this publication change?"
            onChange={value => setSummary(value ?? '')}
            data-testid="publish-summary"
          />
        </FormElement>
      </div>
    </Dialog>
  );
};
