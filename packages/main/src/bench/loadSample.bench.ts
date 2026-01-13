import { bench, describe, afterEach } from 'vitest';
import {
  defaultEdgeRegistry,
  defaultNodeRegistry
} from '@diagram-craft/canvas-app/defaultRegistry';
import {
  makeDefaultDiagramFactory,
  makeDefaultDocumentFactory
} from '@diagram-craft/model/diagramDocumentFactory';
import { deserializeDiagramDocument } from '@diagram-craft/model/serialization/deserialize';
import shapes from '../../public/sample/shapes.json';
import arrows from '../../public/sample/arrows.json';
import { CollaborationConfig } from '@diagram-craft/collaboration/collaborationConfig';
import { NoOpCRDTMap, NoOpCRDTRoot } from '@diagram-craft/collaboration/noopCrdt';

const origRoot = CollaborationConfig.CRDTRoot;
const origMap = CollaborationConfig.CRDTMap;

const nodeRegistry = defaultNodeRegistry();
const edgeRegistry = defaultEdgeRegistry();

const diagramFactory = makeDefaultDiagramFactory();
const documentFactory = makeDefaultDocumentFactory(nodeRegistry, edgeRegistry);

describe('loadSample', () => {
  afterEach(async () => {
    await new Promise(res => setImmediate(res));
  });
  bench(
    'loadShapes',
    async () => {
      // biome-ignore lint/suspicious/noExplicitAny: false positive
      const root = await documentFactory.loadCRDT(undefined, {} as any, () => {});
      const document = await documentFactory.createDocument(root, undefined, () => {});

      // biome-ignore lint/suspicious/noExplicitAny: false positive
      await deserializeDiagramDocument(shapes as any, document, diagramFactory);
    },
    {
      time: 100,
      iterations: 5,
      warmupIterations: 2,
      warmupTime: 100,
      setup: () => {
        CollaborationConfig.CRDTRoot = NoOpCRDTRoot;
        CollaborationConfig.CRDTMap = NoOpCRDTMap;
      },
      teardown: () => {
        CollaborationConfig.CRDTRoot = origRoot;
        CollaborationConfig.CRDTMap = origMap;
      }
    }
  );
  bench.skip(
    'loadArrows',
    async () => {
      // biome-ignore lint/suspicious/noExplicitAny: false positive
      const root = await documentFactory.loadCRDT(undefined, {} as any, () => {});
      const document = await documentFactory.createDocument(root, undefined, () => {});

      // biome-ignore lint/suspicious/noExplicitAny: false positive
      await deserializeDiagramDocument(arrows as any, document, diagramFactory);
    },
    {
      time: 100,
      iterations: 5,
      warmupIterations: 2,
      warmupTime: 100,
      setup: () => {
        CollaborationConfig.CRDTRoot = NoOpCRDTRoot;
        CollaborationConfig.CRDTMap = NoOpCRDTMap;
      },
      teardown: () => {
        CollaborationConfig.CRDTRoot = origRoot;
        CollaborationConfig.CRDTMap = origMap;
      }
    }
  );
});
