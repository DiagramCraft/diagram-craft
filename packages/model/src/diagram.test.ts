import { describe, expect, it, vi } from 'vitest';
import { Diagram, DocumentBuilder } from './diagram';
import { TestModel } from './test-support/builder';
import { newid } from '@diagram-craft/utils/id';
import { UnitOfWork } from './unitOfWork';
import { DiagramNode } from './diagramNode';
import { TransformFactory } from '@diagram-craft/geometry/transform';
import { RegularLayer } from './diagramLayerRegular';
import { assertRegularLayer } from './diagramLayerUtils';
import { Backends, standardTestModel } from './collaboration/collaborationTestUtils';

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
      doc1.diagrams[0]!.on('change', diagramChange[0]!);
      doc2?.diagrams[0]?.on?.('change', diagramChange[1]!);

      const documentDiagramChange = [vi.fn(), vi.fn()];
      doc1.on('diagramChanged', documentDiagramChange[0]!);
      doc2?.on?.('diagramChanged', documentDiagramChange[1]!);

      // Act
      doc1.diagrams[0]!.name = 'new';

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
      doc1.diagrams[0]!.on('change', diagramChange[0]!);
      doc2?.diagrams[0]?.on?.('change', diagramChange[1]!);

      const documentDiagramChange = [vi.fn(), vi.fn()];
      doc1.on('diagramChanged', documentDiagramChange[0]!);
      doc2?.on?.('diagramChanged', documentDiagramChange[1]!);

      const diagram = doc1.diagrams[0]!;

      // Act
      diagram.updateProps(props => {
        props.grid ??= {};
        props.grid.enabled = false;
      });

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
      diagram.updateProps(props => {
        props.grid ??= {};
        props.grid.enabled = true;
      });

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
      expect(diagram.canvas).toBeDefined();
      expect(diagram.canvas).toEqual({ x: 0, y: 0, w: 640, h: 640 });
    });

    it('should update correctly', () => {
      // Setup
      const { doc1, doc2 } = standardTestModel(backend);

      const diagramChange = [vi.fn(), vi.fn()];
      doc1.diagrams[0]!.on('change', diagramChange[0]!);
      doc2?.diagrams[0]?.on?.('change', diagramChange[1]!);

      const documentDiagramChange = [vi.fn(), vi.fn()];
      doc1.on('diagramChanged', documentDiagramChange[0]!);
      doc2?.on?.('diagramChanged', documentDiagramChange[1]!);

      // Act
      const diagram = doc1.diagrams[0]!;
      diagram.canvas = { x: 100, y: 100, w: 110, h: 100 };

      // Verify
      expect(diagram.canvas).toEqual({ x: 100, y: 100, w: 110, h: 100 });
      expect(diagramChange[0]).toHaveBeenCalledTimes(1);
      expect(documentDiagramChange[0]).toHaveBeenCalledTimes(0);
      if (doc2) {
        expect(doc2.diagrams[0]!.canvas).toEqual({ x: 100, y: 100, w: 110, h: 100 });
        expect(diagramChange[1]).toHaveBeenCalledTimes(1);
        expect(documentDiagramChange[1]).toHaveBeenCalledTimes(0);
      }
    });
  });

  describe('visibleElements', () => {
    it('toggle visibility', () => {
      const diagram = TestModel.newDiagram();

      const layer1 = new RegularLayer(newid(), 'Layer 1', [], diagram);
      diagram.layers.add(layer1, new UnitOfWork(diagram));

      const layer2 = new RegularLayer(newid(), 'Layer 2', [], diagram);
      diagram.layers.add(layer2, new UnitOfWork(diagram));

      const uow = new UnitOfWork(diagram);
      const node1 = DiagramNode.create('1', 'rect', testBounds, layer1, {}, {});
      const node2 = DiagramNode.create('2', 'rect', testBounds, layer2, {}, {});
      layer1.addElement(node1, uow);
      layer2.addElement(node2, uow);
      uow.commit();

      expect(diagram.visibleElements()).toStrictEqual([node1, node2]);
      diagram.layers.toggleVisibility(layer1);
      expect(diagram.visibleElements()).toStrictEqual([node2]);
      diagram.layers.toggleVisibility(layer2);
      expect(diagram.visibleElements()).toStrictEqual([]);
    });
  });

  describe('transformElements', () => {
    it('transform rotate', () => {
      const diagram = TestModel.newDiagram();
      diagram.newLayer();

      const uow = new UnitOfWork(diagram);

      const layer = diagram.activeLayer;
      assertRegularLayer(layer);

      const node1 = DiagramNode.create('1', 'rect', testBounds, layer, {}, {});
      layer.addElement(node1, uow);

      const node2 = DiagramNode.create(
        '2',
        'rect',
        {
          x: 100,
          y: 100,
          w: 100,
          h: 100,
          r: 0
        },
        layer,
        {},
        {}
      );
      layer.addElement(node2, uow);

      const nodes = [node1, node2];

      const before = { x: 0, y: 0, w: 200, h: 200, r: 0 };
      const after = { x: 0, y: 0, w: 200, h: 200, r: Math.PI / 2 };

      diagram.transformElements(nodes, TransformFactory.fromTo(before, after), uow);
      uow.commit();

      expect(node1.bounds).toStrictEqual({ x: 100, y: 0, w: 100, h: 100, r: Math.PI / 2 });
      expect(node2.bounds).toStrictEqual({ x: 0, y: 100, w: 100, h: 100, r: Math.PI / 2 });
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
      doc1.diagrams[0]!.on('change', diagramChange[0]!);
      doc2?.diagrams[0]?.on?.('change', diagramChange[1]!);

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
      doc1.diagrams[0]!.on('change', diagramChange[0]!);
      doc2?.diagrams[0]?.on?.('change', diagramChange[1]!);

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
      doc1.diagrams[0]!.on('change', diagramChange[0]!);
      doc2?.diagrams[0]?.on?.('change', diagramChange[1]!);

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
