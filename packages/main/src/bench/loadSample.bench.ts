import { describe, test } from 'vitest';
import {
  defaultEdgeRegistry,
  defaultNodeRegistry,
  defaultStencilRegistry
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

const opts = { time: 2000 };

const stencils = defaultStencilRegistry();
const nodes = defaultNodeRegistry();
const edges = defaultEdgeRegistry();

const diagramFactory = makeDefaultDiagramFactory();
const documentFactory = makeDefaultDocumentFactory({ nodes, edges, stencils });

const useNoOpCRDT = () => {
  CollaborationConfig.CRDTRoot = NoOpCRDTRoot;
  CollaborationConfig.CRDTMap = NoOpCRDTMap;
  return () => {
    CollaborationConfig.CRDTRoot = origRoot;
    CollaborationConfig.CRDTMap = origMap;
  };
};

describe('loadSample', () => {
  test.skip('loadShapes', async ({ bench }) => {
    const restore = useNoOpCRDT();
    try {
      await bench('loadShapes', async () => {
        // biome-ignore lint/suspicious/noExplicitAny: false positive
        const root = await documentFactory.loadCRDT(undefined, {} as any, () => {});
        const document = await documentFactory.createDocument(root, undefined, () => {});

        // biome-ignore lint/suspicious/noExplicitAny: false positive
        await deserializeDiagramDocument(shapes as any, document, diagramFactory);
      }).run(opts);
    } finally {
      restore();
    }
  });
  test.skip('loadArrows', async ({ bench }) => {
    const restore = useNoOpCRDT();
    try {
      await bench('loadArrows', async () => {
        // biome-ignore lint/suspicious/noExplicitAny: false positive
        const root = await documentFactory.loadCRDT(undefined, {} as any, () => {});
        const document = await documentFactory.createDocument(root, undefined, () => {});

        // biome-ignore lint/suspicious/noExplicitAny: false positive
        await deserializeDiagramDocument(arrows as any, document, diagramFactory);
      }).run(opts);
    } finally {
      restore();
    }
  });
});
