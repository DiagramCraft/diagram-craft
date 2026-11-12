import type { ReactNode } from 'react';
import { Dialog } from '@diagram-craft/app-components/Dialog';

/** Scrollable dialog hosting a version history list. */
export const VersionHistoryDialog = ({
  open,
  onClose,
  children
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) => (
  <Dialog
    open={open}
    onClose={onClose}
    title="Version history"
    width={560}
    scrollable
    buttons={[{ label: 'Close', type: 'cancel', onClick: onClose }]}
  >
    {children}
  </Dialog>
);
