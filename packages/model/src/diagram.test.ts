import { describe, expect, it, vi } from 'vitest';
import { Diagram, DocumentBuilder } from './diagram';
import { TestModel } from './test-support/testModel';
import { newid } from '@diagram-craft/utils/id';
import { UnitOfWork } from './unitOfWork';
import { RegularLayer } from './diagramLayerRegular';
import { standardTestModel } from './test-support/collaborationModelTestUtils';
import { ElementFactory } from './elementFactory';
import { Backends } from '@diagram-craft/collaboration/test-support/collaborationTestUtils';

const testBounds = { x: 0, y: 0, w: 100, h: 100, r: 0 };

describe.each(Backends.all())('Diagram [%s]', (_name, backend) => {
  describe('constructor', () => {
    it('should initialize correctly using the constructor', () => {
      const doc = TestModel.newDocument();
      const diagram = new Diagram('test-id', 'test-name', doc);
      expect(diagram.id).toBe('test-id');
      expect(diagram.name).toBe('test-name');
      expect(diagram.document).toBe(doc);
    });
  });

  describe('name', () => {
    it('should update the name property correctly', () => {
      // Setup
      const { doc1, doc2 } = standardTestModel(backend);
      const diagramChange = [vi.fn(), vi.fn()];
      doc1.diagrams[0]!.on('diagramChange', diagramChange[0]!);
      doc2?.diagrams[0]?.on?.('diagramChange', diagramChange[1]!);

      const documentDiagramChange = [vi.fn(), vi.fn()];
      doc1.on('diagramChanged', documentDiagramChange[0]!);
      doc2?.on?.('diagramChanged', documentDiagramChange[1]!);

      // Act
      UnitOfWork.executeSilently(doc1.diagrams[0]!, uow => doc1.diagrams[0]!.setName('new', uow));

      // Verify
      expect(doc1.diagrams[0]!.name).toBe('new');
      expect(diagramChange[0]).toHaveBeenCalledTimes(1);
      expect(documentDiagramChange[0]).toHaveBeenCalledTimes(1);
      if (doc2) {
        expect(doc2.diagrams[0]!.name).toBe('new');
        expect(diagramChange[1]).toHaveBeenCalledTimes(1);
        expect(documentDiagramChange[1]).toHaveBeenCalledTimes(1);
      }
    });
  });

  describe('props', () => {
    it('should initialize with empty props', () => {
      // Setup
      const { doc1, doc2 } = standardTestModel(backend);

      // Verify
      expect(doc1.diagrams[0]!.props).toEqual({});
      if (doc2) expect(doc2.diagrams[0]!.props).toEqual({});
    });

    it('should update props correctly', () => {
      // Setup
      const { doc1, doc2 } = standardTestModel(backend);

      const diagramChange = [vi.fn(), vi.fn()];
      doc1.diagrams[0]!.on('diagramChange', diagramChange[0]!);
      doc2?.diagrams[0]?.on?.('diagramChange', diagramChange[1]!);

      const documentDiagramChange = [vi.fn(), vi.fn()];
      doc1.on('diagramChanged', documentDiagramChange[0]!);
      doc2?.on?.('diagramChanged', documentDiagramChange[1]!);

      const diagram = doc1.diagrams[0]!;

      // Act
      UnitOfWork.executeSilently(diagram, uow =>
        diagram.updateProps(props => {
          props.grid ??= {};
          props.grid.enabled = false;
        }, uow)
      );

      // Verify
      expect(diagram.props).toEqual({ grid: { enabled: false } });
      expect(diagramChange[0]).toHaveBeenCalledTimes(1);
      expect(documentDiagramChange[0]).toHaveBeenCalledTimes(0);
      if (doc2) {
        expect(doc2.diagrams[0]!.props).toEqual({ grid: { enabled: false } });
        expect(diagramChange[1]).toHaveBeenCalledTimes(1);
        expect(documentDiagramChange[1]).toHaveBeenCalledTimes(0);
      }

      // Act
      UnitOfWork.executeSilently(diagram, uow =>
        diagram.updateProps(props => {
          props.grid ??= {};
          props.grid.enabled = true;
        }, uow)
      );

      // Verify
      expect(diagram.props).toEqual({
        grid: { enabled: true }
      });
      if (doc2) {
        expect(doc2.diagrams[0]!.props).toEqual({
          grid: { enabled: true }
        });
      }
    });
  });

  describe('canvas', () => {
    it('should initialize correctly', () => {
      const doc = TestModel.newDocument();
      const diagram = new Diagram('test-id', 'test-name', doc);
      expect(diagram.bounds).toBeDefined();
      expect(diagram.bounds).toEqual({ x: 0, y: 0, w: 640, h: 640 });
    });

    it('should update correctly', () => {
      // Setup
      const { doc1, doc2 } = standardTestModel(backend);

      const diagramChange = [vi.fn(), vi.fn()];
      doc1.diagrams[0]!.on('diagramChange', diagramChange[0]!);
      doc2?.diagrams[0]?.on?.('diagramChange', diagramChange[1]!);

      const documentDiagramChange = [vi.fn(), vi.fn()];
      doc1.on('diagramChanged', documentDiagramChange[0]!);
      doc2?.on?.('diagramChanged', documentDiagramChange[1]!);

      // Act
      const diagram = doc1.diagrams[0]!;
      UnitOfWork.executeSilently(diagram, uow =>
        diagram.setBounds({ x: 100, y: 100, w: 110, h: 100 }, uow)
      );

      // Verify
      expect(diagram.bounds).toEqual({ x: 100, y: 100, w: 110, h: 100 });
      expect(diagramChange[0]).toHaveBeenCalledTimes(1);
      expect(documentDiagramChange[0]).toHaveBeenCalledTimes(0);
      if (doc2) {
        expect(doc2.diagrams[0]!.bounds).toEqual({ x: 100, y: 100, w: 110, h: 100 });
        expect(diagramChange[1]).toHaveBeenCalledTimes(1);
        expect(documentDiagramChange[1]).toHaveBeenCalledTimes(0);
      }
    });
  });

  describe('visibleElements', () => {
    it('toggle visibility', () => {
      const diagram = TestModel.newDiagram();

      const layer1 = new RegularLayer(newid(), 'Layer 1', [], diagram);
      const layer2 = new RegularLayer(newid(), 'Layer 2', [], diagram);

      const node1 = ElementFactory.node('1', 'rect', testBounds, layer1, {}, {});
      const node2 = ElementFactory.node('2', 'rect', testBounds, layer2, {}, {});

      UnitOfWork.execute(diagram, uow => {
        diagram.layers.add(layer1, uow);
        diagram.layers.add(layer2, uow);

        layer1.addElement(node1, uow);
        layer2.addElement(node2, uow);
      });

      expect(diagram.visibleElements()).toStrictEqual([node1, node2]);
      diagram.layers.toggleVisibility(layer1);
      expect(diagram.visibleElements()).toStrictEqual([node2]);
      diagram.layers.toggleVisibility(layer2);
      expect(diagram.visibleElements()).toStrictEqual([]);
    });
  });

  describe('guides', () => {
    it('should initialize with empty guides', () => {
      // Setup
      const { doc1, doc2 } = standardTestModel(backend);

      // Verify
      expect(doc1.diagrams[0]!.guides).toEqual([]);
      if (doc2) expect(doc2.diagrams[0]!.guides).toEqual([]);
    });

    it('should add guides correctly', () => {
      // Setup
      const { doc1, doc2 } = standardTestModel(backend);

      const diagramChange = [vi.fn(), vi.fn()];
      doc1.diagrams[0]!.on('diagramChange', diagramChange[0]!);
      doc2?.diagrams[0]?.on?.('diagramChange', diagramChange[1]!);

      const diagram = doc1.diagrams[0]!;

      // Act - add horizontal guide
      const hGuide = diagram.addGuide({ type: 'horizontal', position: 100, color: 'red' });

      // Verify
      expect(hGuide.type).toBe('horizontal');
      expect(hGuide.position).toBe(100);
      expect(hGuide.color).toBe('red');
      expect(diagram.guides).toHaveLength(1);
      expect(diagram.guides[0]).toEqual(hGuide);
      expect(diagramChange[0]).toHaveBeenCalledTimes(1);

      if (doc2) {
        expect(doc2.diagrams[0]!.guides).toHaveLength(1);
        expect(doc2.diagrams[0]!.guides[0]).toEqual(hGuide);
        expect(diagramChange[1]).toHaveBeenCalledTimes(1);
      }

      // Act - add vertical guide
      const vGuide = diagram.addGuide({ type: 'vertical', position: 200 });

      // Verify
      expect(vGuide.type).toBe('vertical');
      expect(vGuide.position).toBe(200);
      expect(vGuide.color).toBeUndefined();
      expect(diagram.guides).toHaveLength(2);

      if (doc2) {
        expect(doc2.diagrams[0]!.guides).toHaveLength(2);
      }
    });

    it('should remove guides correctly', () => {
      // Setup
      const { doc1, doc2 } = standardTestModel(backend);
      const diagram = doc1.diagrams[0]!;
      const guide = diagram.addGuide({ type: 'horizontal', position: 100, color: 'blue' });

      const diagramChange = [vi.fn(), vi.fn()];
      doc1.diagrams[0]!.on('diagramChange', diagramChange[0]!);
      doc2?.diagrams[0]?.on?.('diagramChange', diagramChange[1]!);

      // Act
      diagram.removeGuide(guide.id);

      // Verify
      expect(diagram.guides).toHaveLength(0);
      expect(diagramChange[0]).toHaveBeenCalledTimes(1);

      if (doc2) {
        expect(doc2.diagrams[0]!.guides).toHaveLength(0);
        expect(diagramChange[1]).toHaveBeenCalledTimes(1);
      }
    });

    it('should update guides correctly', () => {
      // Setup
      const { doc1, doc2 } = standardTestModel(backend);
      const diagram = doc1.diagrams[0]!;
      const guide = diagram.addGuide({ type: 'vertical', position: 150 });

      const diagramChange = [vi.fn(), vi.fn()];
      doc1.diagrams[0]!.on('diagramChange', diagramChange[0]!);
      doc2?.diagrams[0]?.on?.('diagramChange', diagramChange[1]!);

      // Act
      diagram.updateGuide(guide.id, { position: 300, color: 'green' });

      // Verify
      const updatedGuide = diagram.guides.find(g => g.id === guide.id);
      expect(updatedGuide?.position).toBe(300);
      expect(updatedGuide?.color).toBe('green');
      expect(updatedGuide?.type).toBe('vertical'); // Should remain unchanged
      expect(diagramChange[0]).toHaveBeenCalledTimes(1);

      if (doc2) {
        const remoteGuide = doc2.diagrams[0]!.guides.find(g => g.id === guide.id);
        expect(remoteGuide?.position).toBe(300);
        expect(remoteGuide?.color).toBe('green');
        expect(diagramChange[1]).toHaveBeenCalledTimes(1);
      }
    });
  });

  describe('moveElement', () => {
    it('should move element to a different layer', () => {
      // Setup
      const { diagram, layer } = TestModel.newDiagramWithLayer();
      const layer2 = diagram.newLayer();
      const node = layer.addNode();
      const nodeId = node.id;
      const layer1Id = layer.id;
      const layer2Id = layer2.id;

      // Helper to get fresh node reference
      const getNode = () => diagram.nodeLookup.get(nodeId)!;

      // Verify initial state
      expect(layer.elements).toContain(node);
      expect(layer2.elements).not.toContain(node);

      // Act
      UnitOfWork.executeWithUndo(diagram, 'Move element', uow => {
        diagram.moveElement([node], uow, layer2);
      });

      // Verify
      expect(layer.elements.map(e => e.id)).not.toContain(nodeId);
      expect(layer2.elements.map(e => e.id)).toContain(nodeId);
      expect(getNode().layer.id).toBe(layer2Id);

      // Undo
      diagram.undoManager.undo();

      // Verify undo
      expect((diagram.layers.byId(layer1Id)! as RegularLayer).elements.map(e => e.id)).toContain(
        nodeId
      );
      expect(
        (diagram.layers.byId(layer2Id)! as RegularLayer).elements.map(e => e.id)
      ).not.toContain(nodeId);
      expect(getNode().layer.id).toBe(layer1Id);

      // Redo
      diagram.undoManager.redo();

      // Verify redo
      expect(
        (diagram.layers.byId(layer1Id)! as RegularLayer).elements.map(e => e.id)
      ).not.toContain(nodeId);
      expect((diagram.layers.byId(layer2Id)! as RegularLayer).elements.map(e => e.id)).toContain(
        nodeId
      );
      expect(getNode().layer.id).toBe(layer2Id);
    });

    it('should move multiple elements to a different layer', () => {
      // Setup
      const { diagram, layer } = TestModel.newDiagramWithLayer();
      const layer2 = diagram.newLayer();
      const node1 = layer.addNode();
      const node2 = layer.addNode();
      const node1Id = node1.id;
      const node2Id = node2.id;
      const layer1Id = layer.id;
      const layer2Id = layer2.id;

      // Act
      UnitOfWork.executeWithUndo(diagram, 'Move multiple elements', uow => {
        diagram.moveElement([node1, node2], uow, layer2);
      });

      // Verify
      expect((diagram.layers.byId(layer1Id)! as RegularLayer).elements).toHaveLength(0);
      expect((diagram.layers.byId(layer2Id)! as RegularLayer).elements).toHaveLength(2);
      expect((diagram.layers.byId(layer2Id)! as RegularLayer).elements.map(e => e.id)).toContain(
        node1Id
      );
      expect((diagram.layers.byId(layer2Id)! as RegularLayer).elements.map(e => e.id)).toContain(
        node2Id
      );

      // Undo
      diagram.undoManager.undo();

      // Verify undo - nodes should be back in original layer
      expect((diagram.layers.byId(layer1Id)! as RegularLayer).elements).toHaveLength(2);
      expect((diagram.layers.byId(layer2Id)! as RegularLayer).elements).toHaveLength(0);
      expect((diagram.layers.byId(layer1Id)! as RegularLayer).elements.map(e => e.id)).toContain(
        node1Id
      );
      expect((diagram.layers.byId(layer1Id)! as RegularLayer).elements.map(e => e.id)).toContain(
        node2Id
      );

      // Redo
      diagram.undoManager.redo();

      // Verify redo
      expect((diagram.layers.byId(layer1Id)! as RegularLayer).elements).toHaveLength(0);
      expect((diagram.layers.byId(layer2Id)! as RegularLayer).elements).toHaveLength(2);
      expect((diagram.layers.byId(layer2Id)! as RegularLayer).elements.map(e => e.id)).toContain(
        node1Id
      );
      expect((diagram.layers.byId(layer2Id)! as RegularLayer).elements.map(e => e.id)).toContain(
        node2Id
      );
    });

    it('should move element above another element', () => {
      // Setup
      const { diagram, layer } = TestModel.newDiagramWithLayer();
      const node1 = layer.addNode();
      const node2 = layer.addNode();
      const node3 = layer.addNode();
      const node1Id = node1.id;
      const node2Id = node2.id;
      const node3Id = node3.id;
      const layerId = layer.id;

      // Helper to get fresh layer reference
      const getLayer = () => diagram.layers.byId(layerId)! as RegularLayer;

      // Act - move node1 above node3
      UnitOfWork.executeWithUndo(diagram, 'Move element above', uow => {
        diagram.moveElement([node1], uow, layer, {
          relation: 'above',
          element: node3
        });
      });

      // Verify - order should be [node2, node3, node1]
      expect(getLayer().elements.map(e => e.id)).toEqual([node2Id, node3Id, node1Id]);

      // Undo
      diagram.undoManager.undo();

      // Verify undo - all nodes should be back in the layer
      // Note: The exact order after undo may vary, so we just check presence
      expect(getLayer().elements.map(e => e.id)).toEqual([node1Id, node2Id, node3Id]);

      // Redo
      diagram.undoManager.redo();

      // Verify redo - order should be [node2, node3, node1] again
      expect(getLayer().elements.map(e => e.id)).toEqual([node2Id, node3Id, node1Id]);
    });

    it('should move element below another element', () => {
      // Setup
      const { diagram, layer } = TestModel.newDiagramWithLayer();
      const node1 = layer.addNode();
      const node2 = layer.addNode();
      const node3 = layer.addNode();

      // Act - move node3 below node1
      UnitOfWork.execute(diagram, uow => {
        diagram.moveElement([node3], uow, layer, {
          relation: 'below',
          element: node1
        });
      });

      // Verify - order should be [node3, node1, node2]
      expect(layer.elements.indexOf(node3)).toBe(0);
      expect(layer.elements.indexOf(node1)).toBe(1);
      expect(layer.elements.indexOf(node2)).toBe(2);
    });

    it('should move element into a container node', () => {
      // Setup
      const { diagram, layer } = TestModel.newDiagramWithLayer();
      const container = layer.addNode({ type: 'container' });
      const node = layer.addNode();
      const containerId = container.id;
      const nodeId = node.id;

      // Helpers to get fresh references
      const getContainer = () => diagram.nodeLookup.get(containerId)!;
      const getNode = () => diagram.nodeLookup.get(nodeId)!;

      // Act
      UnitOfWork.executeWithUndo(diagram, 'Move into container', uow => {
        diagram.moveElement([node], uow, layer, {
          relation: 'on',
          element: container
        });
      });

      // Verify
      expect(getContainer().children.map(c => c.id)).toContain(nodeId);
      expect(getNode().parent?.id).toBe(containerId);

      // Undo
      diagram.undoManager.undo();

      // Verify undo - node should be back in layer, not in container
      expect(getContainer().children.map(c => c.id)).not.toContain(nodeId);
      expect(getNode().parent).toBeUndefined();

      // Redo
      diagram.undoManager.redo();

      // Verify redo - node should be back in container
      expect(getContainer().children.map(c => c.id)).toContain(nodeId);
      expect(getNode().parent?.id).toBe(containerId);
    });

    it('should move element from one container to another', () => {
      // Setup
      const { diagram, layer } = TestModel.newDiagramWithLayer();
      const container1 = layer.addNode({ type: 'container' });
      const container2 = layer.addNode({ type: 'container' });
      const node = layer.addNode();

      UnitOfWork.execute(diagram, uow => {
        diagram.moveElement([node], uow, layer, {
          relation: 'on',
          element: container1
        });
      });

      // Verify initial state
      expect(container1.children).toContain(node);
      expect(node.parent).toBe(container1);

      // Act - move to second container
      UnitOfWork.execute(diagram, uow => {
        diagram.moveElement([node], uow, layer, {
          relation: 'on',
          element: container2
        });
      });

      // Verify
      expect(container1.children).not.toContain(node);
      expect(container2.children).toContain(node);
      expect(node.parent).toBe(container2);
    });

    it('should move element above a child in a container', () => {
      // Setup
      const { diagram, layer } = TestModel.newDiagramWithLayer();
      const container = layer.addNode({ type: 'container' });
      const child1 = layer.addNode();
      const child2 = layer.addNode();
      const child3 = layer.addNode();

      UnitOfWork.execute(diagram, uow => {
        diagram.moveElement([child1, child2, child3], uow, layer, {
          relation: 'on',
          element: container
        });
      });

      // Act - move child1 above child3
      UnitOfWork.execute(diagram, uow => {
        diagram.moveElement([child1], uow, layer, {
          relation: 'above',
          element: child3
        });
      });

      // Verify - order should be [child2, child3, child1]
      expect(container.children.indexOf(child2)).toBe(0);
      expect(container.children.indexOf(child3)).toBe(1);
      expect(container.children.indexOf(child1)).toBe(2);
    });

    it('should move element below a child in a container', () => {
      // Setup
      const { diagram, layer } = TestModel.newDiagramWithLayer();
      const container = layer.addNode({ type: 'container' });
      const child1 = layer.addNode();
      const child2 = layer.addNode();

      UnitOfWork.execute(diagram, uow => {
        diagram.moveElement([child1, child2], uow, layer, {
          relation: 'on',
          element: container
        });
      });

      // Act - move child2 below child1
      UnitOfWork.execute(diagram, uow => {
        diagram.moveElement([child2], uow, layer, {
          relation: 'below',
          element: child1
        });
      });

      // Verify - order should be [child2, child1]
      expect(container.children.indexOf(child2)).toBe(0);
      expect(container.children.indexOf(child1)).toBe(1);
    });

    it('should not move element into itself', () => {
      // Setup
      const { diagram, layer } = TestModel.newDiagramWithLayer();
      const node = layer.addNode({ type: 'container' });

      // Act
      UnitOfWork.execute(diagram, uow => {
        diagram.moveElement([node], uow, layer, {
          relation: 'on',
          element: node
        });
      });

      // Verify - nothing should change, node should not be its own parent
      expect(node.parent).toBeUndefined();
    });

    it('should handle moving elements between different layers', () => {
      // Setup
      const { diagram, layer } = TestModel.newDiagramWithLayer();
      const layer3 = diagram.newLayer();
      const node = layer.addNode();

      // Act - move from first layer to third layer
      UnitOfWork.execute(diagram, uow => {
        diagram.moveElement([node], uow, layer3);
      });

      // Verify
      expect(layer.elements).not.toContain(node);
      expect(layer3.elements).toContain(node);
      expect(node.layer).toBe(layer3);
    });

    it('should handle moving elements back to earlier layer', () => {
      // Setup
      const { diagram, layer } = TestModel.newDiagramWithLayer();
      const layer3 = diagram.newLayer();
      const node = layer3.addNode();

      // Act - move from third layer back to first layer
      UnitOfWork.execute(diagram, uow => {
        diagram.moveElement([node], uow, layer);
      });

      // Verify
      expect(layer3.elements).not.toContain(node);
      expect(layer.elements).toContain(node);
      expect(node.layer).toBe(layer);
    });

    it('should preserve element order when moving from lower to higher layer', () => {
      // Setup
      const { diagram, layer } = TestModel.newDiagramWithLayer();
      const layer2 = diagram.newLayer();
      const node1 = layer2.addNode();
      const node2 = layer2.addNode();
      const node3 = layer.addNode();

      // Note: layer is above layer2 (lower index), layer2 is below (higher index)

      // Act - move nodes from layer2 (below) to layer (above)
      UnitOfWork.execute(diagram, uow => {
        diagram.moveElement([node1, node2], uow, layer);
      });

      // Verify - nodes should be added at the end since layer is above layer2
      expect(layer.elements.indexOf(node3)).toBe(0);
      expect(layer.elements.indexOf(node1)).toBe(1);
      expect(layer.elements.indexOf(node2)).toBe(2);
    });

    it('should preserve element order when moving from higher to lower layer', () => {
      // Setup
      const { diagram, layer } = TestModel.newDiagramWithLayer();
      const layer2 = diagram.newLayer();
      const node1 = layer.addNode();
      const node2 = layer.addNode();
      const node3 = layer2.addNode();

      // Note: layer is above layer2 (lower index), layer2 is below (higher index)

      // Act - move nodes from layer (above) to layer2 (below)
      UnitOfWork.execute(diagram, uow => {
        diagram.moveElement([node1, node2], uow, layer2);
      });

      // Verify - nodes should be added at the beginning since layer2 is below layer
      expect(layer2.elements.indexOf(node1)).toBe(0);
      expect(layer2.elements.indexOf(node2)).toBe(1);
      expect(layer2.elements.indexOf(node3)).toBe(2);
    });

    it('should remove element from parent when moving to another layer', () => {
      // Setup
      const { diagram, layer } = TestModel.newDiagramWithLayer();
      const layer2 = diagram.newLayer();
      const container = layer.addNode({ type: 'container' });
      const child = layer.addNode();

      UnitOfWork.execute(diagram, uow => {
        diagram.moveElement([child], uow, layer, {
          relation: 'on',
          element: container
        });
      });

      // Verify setup
      expect(container.children).toContain(child);
      expect(child.parent).toBe(container);

      // Act - move child to different layer
      UnitOfWork.execute(diagram, uow => {
        diagram.moveElement([child], uow, layer2);
      });

      // Verify - child should no longer be in container
      expect(container.children).not.toContain(child);
      expect(child.parent).toBeUndefined();
      expect(layer2.elements).toContain(child);
    });
  });

  describe('DocumentBuilder', () => {
    describe('empty', () => {
      it('should create a diagram with a default layer', () => {
        // Setup
        const id = 'test-id';
        const name = 'test-name';
        const doc = TestModel.newDocument();

        // Act
        const { diagram, layer } = DocumentBuilder.empty(id, name, doc);

        // Verify
        expect(diagram.id).toBe(id);
        expect(diagram.name).toBe(name);
        expect(diagram.document).toBe(doc);
        expect(layer.id).toBe('default');
        expect(layer.name).toBe('Default');
        expect(diagram.layers.all.length).toBe(1);
        expect(diagram.layers.all[0]).toBe(layer);
      });
    });
  });
});
