import { CollaborationBackend, NoOpCollaborationBackend } from './backend';
import type { CRDTMap, CRDTRoot } from './crdt';
import { NoOpCRDTMap, NoOpCRDTRoot } from './noopCrdt';

export const CollaborationConfig: {
  isNoOp: boolean;
  CRDTRoot: new (...args: unknown[]) => CRDTRoot;
  CRDTMap: new (...args: unknown[]) => CRDTMap<unknown>;
  Backend: CollaborationBackend;
} = {
  isNoOp: true,
  CRDTRoot: NoOpCRDTRoot,
  CRDTMap: NoOpCRDTMap,
  Backend: new NoOpCollaborationBackend()
};
