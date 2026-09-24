import { Dialog } from '@diagram-craft/app-components/Dialog';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import { BlastRadiusPanel } from '../components/BlastRadiusPanel';

type Props = {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  entityId: string;
  entityName: string;
  schemas: EntitySchema[];
  lifecycleStates: WorkspaceLifecycleState[];
};

export const EntityBlastRadiusDialog = ({
  open,
  onClose,
  workspaceId,
  entityId,
  entityName,
  schemas,
  lifecycleStates
}: Props) => (
  <Dialog
    open={open}
    onClose={onClose}
    title={`Blast radius — ${entityName}`}
    width="min(760px, calc(100vw - 48px))"
    buttons={[{ label: 'Close', type: 'cancel', onClick: onClose }]}
  >
    {open && (
      <BlastRadiusPanel
        workspaceId={workspaceId}
        subject={{ kind: 'entity', entityId }}
        schemas={schemas}
        lifecycleStates={lifecycleStates}
      />
    )}
  </Dialog>
);
