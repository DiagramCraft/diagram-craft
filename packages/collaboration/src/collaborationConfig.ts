import { CollaborationBackend, NoOpCollaborationBackend } from './backend';
import type { CRDTMap, CRDTRoot } from './crdt';
import { NoOpCRDTMap, NoOpCRDTRoot } from './noopCrdt';

export const CollaborationConfig: {
  isNoOp: boolean;
  CRDTRoot: new (
    // biome-ignore lint/suspicious/noExplicitAny: false positive
    ...args: any[]
  ) => CRDTRoot;
  CRDTMap: new (
    // biome-ignore lint/suspicious/noExplicitAny: false positive
    ...args: any[]
    // biome-ignore lint/suspicious/noExplicitAny: false positive
  ) => CRDTMap<any>;
  Backend: CollaborationBackend;
} = {
  isNoOp: true,
  CRDTRoot: NoOpCRDTRoot,
  CRDTMap: NoOpCRDTMap,
  Backend: new NoOpCollaborationBackend()
};
