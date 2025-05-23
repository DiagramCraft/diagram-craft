import { CollaborationBackend, NoOpCollaborationBackend } from './backend';
import { CRDTList, CRDTMap, CRDTRoot } from './crdt';
import { NoOpCRDTList, NoOpCRDTMap, NoOpCRDTRoot } from './noopCrdt';

export const CollaborationConfig: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  CRDTRoot: new (...args: any[]) => CRDTRoot;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  CRDTMap: new (...args: any[]) => CRDTMap;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  CRDTList: new (...args: any[]) => CRDTList;
  Backend: CollaborationBackend;
} = {
  CRDTRoot: NoOpCRDTRoot,
  CRDTMap: NoOpCRDTMap,
  CRDTList: NoOpCRDTList,
  Backend: new NoOpCollaborationBackend()
};
