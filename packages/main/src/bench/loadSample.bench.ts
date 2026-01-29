import { bench, describe } from 'vitest';
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
import { StencilRegistry } from '@diagram-craft/model/elementDefinitionRegistry';

const origRoot = CollaborationConfig.CRDTRoot;
const origMap = CollaborationConfig.CRDTMap;

const opts = { time: 2000 };

const stencilRegistry = new StencilRegistry();
const nodeRegistry = defaultNodeRegistry(stencilRegistry);
const edgeRegistry = defaultEdgeRegistry(stencilRegistry);

const diagramFactory = makeDefaultDiagramFactory();
const documentFactory = makeDefaultDocumentFactory(nodeRegistry, edgeRegistry, stencilRegistry);

describe('loadSample', () => {
  bench.skip(
    'loadShapes',
    async () => {
      // biome-ignore lint/suspicious/noExplicitAny: false positive
      const root = await documentFactory.loadCRDT(undefined, {} as any, () => {});
      const document = await documentFactory.createDocument(root, undefined, () => {});

      // biome-ignore lint/suspicious/noExplicitAny: false positive
      await deserializeDiagramDocument(shapes as any, document, diagramFactory);
    },
    {
      ...opts,
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
      ...opts,
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
