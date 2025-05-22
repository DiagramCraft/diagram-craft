import { CollaborationBackend, NoOpCollaborationBackend } from './backend';
import { CRDTMap, CRDTRoot } from './crdt';
import { NoOpCRDTMap, NoOpCRDTRoot } from './noopCrdt';

export const CollaborationConfig: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  CRDTRoot: new (...args: any[]) => CRDTRoot;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  CRDTMap: new (...args: any[]) => CRDTMap;
  Backend: CollaborationBackend;
} = {
  CRDTRoot: NoOpCRDTRoot,
  CRDTMap: NoOpCRDTMap,
  Backend: new NoOpCollaborationBackend()
};
