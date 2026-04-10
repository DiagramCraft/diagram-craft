import { describe, expect, it, vi } from 'vitest';
import { Backends } from '@diagram-craft/collaboration/test-support/collaborationTestUtils';
import {
  CustomPropertyDefinition,
  type NodeDefinition,
  type NodeDefinitionLoader
} from './elementDefinitionRegistry';
import { PathList } from '@diagram-craft/geometry/pathList';
import {
  defaultEdgeRegistry,
  defaultNodeRegistry,
  defaultStencilRegistry
} from '@diagram-craft/canvas-app/defaultRegistry';
import { DiagramDocument } from './diagramDocument';
import { Diagram } from './diagram';
import { RegularLayer } from './diagramLayerRegular';
import { UnitOfWork } from './unitOfWork';
import { ElementFactory } from './elementFactory';
import { isNode } from './diagramElement';

const registerUmlClassNode: NodeDefinitionLoader = async nodes => {
  const definition: NodeDefinition = {
    type: 'umlClass',
    name: 'UML Class',
    additionalFillCount: 0,
    hasFlag: () => false,
    getCustomPropertyDefinitions: () => new CustomPropertyDefinition(),
    getBoundingPath: () => new PathList([]),
    getHitArea: () => undefined,
    getAnchors: () => [],
    onAttachEdge: () => undefined,
    onChildChanged: () => {},
    onTransform: () => {},
    onPropUpdate: () => {},
    onAdd: () => {},
    requestFocus: () => {}
  };

  nodes.register(definition);
};

const makeRegistry = () => ({
  nodes: defaultNodeRegistry([
    {
      shapes: /^umlClass$/,
      nodeDefinitionLoader: async () => registerUmlClassNode
    }
  ]),
  edges: defaultEdgeRegistry(),
  stencils: defaultStencilRegistry()
});

describe.each(Backends.all())('DiagramNode CRDT [%s]', (_name, backend) => {
  it('loads lazy node definitions for remote CRDT nodes without logging missing shapes', async () => {
    const [root1, root2] = backend.syncedDocs();
    if (!root2) return;

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      const registry1 = makeRegistry();
      const registry2 = makeRegistry();

      await registry1.nodes.load('umlClass');

      const doc1 = new DiagramDocument(registry1, false, root1);
      const doc2 = new DiagramDocument(registry2, false, root2);

      const diagram1 = new Diagram('diagram', 'diagram', doc1);
      doc1.addDiagram(diagram1);

      const layer1 = new RegularLayer('layer', 'layer', [], diagram1);
      UnitOfWork.execute(diagram1, uow => diagram1.layers.add(layer1, uow));

      UnitOfWork.executeSilently(diagram1, uow => {
        layer1.addElement(
          ElementFactory.node({
            layer: layer1,
            nodeType: 'umlClass'
          }),
          uow
        );
      });

      await vi.waitFor(() => {
        expect(registry2.nodes.hasRegistration('umlClass')).toBe(true);
      });

      await vi.waitFor(() => {
        const node = doc2.diagrams[0]?.layers.all[0]?.elements[0];
        expect(node && isNode(node) ? node.getDefinition().type : undefined).toBe('umlClass');
      });

      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});
