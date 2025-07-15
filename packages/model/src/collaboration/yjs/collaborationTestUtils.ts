import type { CRDTRoot } from '../crdt';
import { createSyncedYJSCRDTs } from './yjsTest';
import { NoOpCRDTMap, NoOpCRDTRoot } from '../noopCrdt';
import { CollaborationConfig } from '../collaborationConfig';
import { YJSMap, YJSRoot } from './yjsCrdt';
import { vi } from 'vitest';

export type Backend = {
  syncedDocs: () => [CRDTRoot, CRDTRoot | undefined];
  beforeEach: () => void;
  afterEach: () => void;
  createFns: () => [ReturnType<typeof vi.fn>, ReturnType<typeof vi.fn>];
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
          },
          createFns: () => {
            return [vi.fn(), vi.fn()];
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
          afterEach: () => {},
          createFns: () => {
            return [vi.fn(), vi.fn()];
          }
        }
      ]
    ];
  }
};
