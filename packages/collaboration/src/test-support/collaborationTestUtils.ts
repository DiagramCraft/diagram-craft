import type { CRDTRoot } from '../crdt';
import { CollaborationConfig } from '../collaborationConfig';
import { YJSMap, YJSRoot } from '../yjs/yjsCrdt';
import { NoOpCRDTMap, NoOpCRDTRoot } from '../noopCrdt';
import { createSyncedYJSCRDTs } from './yjsTestUtils';

export type Backend = {
  syncedDocs: () => [CRDTRoot, CRDTRoot | undefined];
  beforeEach: () => void;
  afterEach: () => void;
};

export const Backends = {
  all: (): Array<[string, Backend]> => {
    return [
      [
        'yjs',
        {
          syncedDocs: () => {
            const yjs = createSyncedYJSCRDTs();
            return [yjs.doc1, yjs.doc2];
          },
          beforeEach: () => {
            CollaborationConfig.CRDTRoot = YJSRoot;
            CollaborationConfig.CRDTMap = YJSMap;
          },
          afterEach: () => {
            CollaborationConfig.CRDTRoot = NoOpCRDTRoot;
            CollaborationConfig.CRDTMap = NoOpCRDTMap;
          }
        }
      ],
      [
        'noop',
        {
          syncedDocs: () => {
            return [new NoOpCRDTRoot(), undefined];
          },
          beforeEach: () => {},
          afterEach: () => {}
        }
      ]
    ];
  }
};
