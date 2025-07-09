import type { CRDTRoot } from '../crdt';
import { createSyncedYJSCRDTs } from './yjsTest';
import { NoOpCRDTMap, NoOpCRDTRoot } from '../noopCrdt';
import { CollaborationConfig } from '../collaborationConfig';
import { YJSMap, YJSRoot } from './yjsCrdt';

export const Backends = {
  all: (): Array<[string, CRDTRoot, CRDTRoot, () => void, () => void]> => {
    const yjs = createSyncedYJSCRDTs();
    const noopDoc = new NoOpCRDTRoot();
    return [
      [
        'yjs',
        yjs.doc1,
        yjs.doc2,
        () => {
          CollaborationConfig.CRDTRoot = YJSRoot;
          CollaborationConfig.CRDTMap = YJSMap;
        },
        () => {
          CollaborationConfig.CRDTRoot = NoOpCRDTRoot;
          CollaborationConfig.CRDTMap = NoOpCRDTMap;
        }
      ],
      ['noop', noopDoc, noopDoc, () => {}, () => {}]
    ];
  }
};
