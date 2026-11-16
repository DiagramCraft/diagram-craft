import { useState } from 'react';
import { Button } from '@diagram-craft/app-components/Button';
import { SettingsBlock, SettingsBlockField } from '../../workspace-settings/SettingsBlock';

export const DemoDataSubSection = () => {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);

  const reset = async () => {
    setPending(true);
    const { resetDemo } = await import('../../../local/startLocalServer');
    await resetDemo();
  };

  return (
    <SettingsBlock
      title="Reset demo"
      description="Discard everything you have changed in this browser and restore the original sample data."
    >
      <SettingsBlockField
        label="Reset demo data"
        hint="This cannot be undone. Other open tabs of the demo will keep their own copy until reloaded."
      >
        {confirming ? (
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="danger-solid" disabled={pending} onClick={() => void reset()}>
              Yes, reset everything
            </Button>
            <Button variant="secondary" disabled={pending} onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button variant="secondary" onClick={() => setConfirming(true)}>
            Reset demo…
          </Button>
        )}
      </SettingsBlockField>
    </SettingsBlock>
  );
};
