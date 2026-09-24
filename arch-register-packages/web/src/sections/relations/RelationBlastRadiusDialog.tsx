import { Dialog } from '@diagram-craft/app-components/Dialog';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import { BlastRadiusPanel } from '../entities/components/BlastRadiusPanel';

type Props = {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  relationId: string | null;
  schemas: EntitySchema[];
  lifecycleStates: WorkspaceLifecycleState[];
};

export const RelationBlastRadiusDialog = ({
  open,
  onClose,
  workspaceId,
  relationId,
  schemas,
  lifecycleStates
}: Props) => (
  <Dialog
    open={open}
    onClose={onClose}
    title="Blast radius"
    width="min(760px, calc(100vw - 48px))"
    buttons={[{ label: 'Close', type: 'cancel', onClick: onClose }]}
  >
    {open && relationId && (
      <BlastRadiusPanel
        workspaceId={workspaceId}
        subject={{ kind: 'relation', relationId }}
        schemas={schemas}
        lifecycleStates={lifecycleStates}
      />
    )}
  </Dialog>
);
