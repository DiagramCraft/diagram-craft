import { CollaborationBackend, NoOpCollaborationBackend } from './backend';
import { CRDTRoot } from './crdt';
import { NoOpCRDTRoot } from './noopCrdt';

export const CollaborationConfig: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  CRDTRoot: new (...args: any[]) => CRDTRoot;
  Backend: CollaborationBackend;
} = {
  CRDTRoot: NoOpCRDTRoot,
  Backend: new NoOpCollaborationBackend()
};
