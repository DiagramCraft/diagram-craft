import { CollaborationBackend, NoOpCollaborationBackend } from './backend';
import type { CRDTMap, CRDTRoot } from './crdt';
import { NoOpCRDTMap, NoOpCRDTRoot } from './noopCrdt';

export const CollaborationConfig: {
  isNoOp: boolean;
  // biome-ignore lint/suspicious/noExplicitAny: false positive
  CRDTRoot: new (...args: any[]) => CRDTRoot;
  // biome-ignore lint/suspicious/noExplicitAny: false positive
  CRDTMap: new (...args: any[]) => CRDTMap<any>;
  Backend: CollaborationBackend;
} = {
  isNoOp: true,
  CRDTRoot: NoOpCRDTRoot,
  CRDTMap: NoOpCRDTMap,
  Backend: new NoOpCollaborationBackend()
};
