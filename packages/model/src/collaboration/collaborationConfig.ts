import { CollaborationBackend, NoOpCollaborationBackend } from './backend';
import type { CRDTMap, CRDTRoot } from './crdt';
import { NoOpCRDTMap, NoOpCRDTRoot } from './noopCrdt';

export const CollaborationConfig: {
  idNoOp: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  CRDTRoot: new (...args: any[]) => CRDTRoot;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  CRDTMap: new (...args: any[]) => CRDTMap<any>;
  Backend: CollaborationBackend;
} = {
  idNoOp: true,
  CRDTRoot: NoOpCRDTRoot,
  CRDTMap: NoOpCRDTMap,
  Backend: new NoOpCollaborationBackend()
};
