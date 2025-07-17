import type { CRDTRoot } from '../crdt';
import { createSyncedYJSCRDTs } from './yjsTest';
import { NoOpCRDTMap, NoOpCRDTRoot } from '../noopCrdt';
import { CollaborationConfig } from '../collaborationConfig';
import { YJSMap, YJSRoot } from './yjsCrdt';
import { vi } from 'vitest';
import { TestModel } from '../../test-support/builder';
import type { RegularLayer } from '../../diagramLayerRegular';

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

export const standardTestModel = (backend: Backend) => {
  const [root1, root2] = backend.syncedDocs();

  const diagram1 = TestModel.newDiagram(root1);
  const doc1 = diagram1.document;
  const layer1 = diagram1.newLayer();

  const doc2 = root2 ? TestModel.newDocument(root2) : undefined;
  const diagram2 = root2 ? doc2!.topLevelDiagrams[0]! : undefined;
  const layer2 = root2 ? (diagram2!.layers.all[0] as RegularLayer) : undefined;

  const elementChange = backend.createFns();
  diagram1.on('elementChange', elementChange[0]);
  if (diagram2) diagram2.on('elementChange', elementChange[1]);

  return {
    root1,
    root2,
    diagram1,
    doc1,
    layer1,
    diagram2,
    doc2,
    layer2,
    elementChange
  };
};
