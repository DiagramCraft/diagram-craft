import { describe, expect, it } from 'vitest';
import { Diagram } from './diagram';
import { TestModel } from './test-support/builder';
import { newid } from '@diagram-craft/utils/id';
import { UnitOfWork } from './unitOfWork';
import { DiagramNode } from './diagramNode';
import { TransformFactory } from '@diagram-craft/geometry/transform';
import { RegularLayer } from './diagramLayerRegular';
import { assertRegularLayer } from './diagramLayerUtils';
import { Backends, standardTestModel } from './collaboration/yjs/collaborationTestUtils';

const bounds = {
  x: 0,
  y: 0,
  w: 100,
  h: 100,
  r: 0
};

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

      // Verify
      expect(doc1.topLevelDiagrams.length).toBe(1);
      expect(doc1.topLevelDiagrams[0].name).toBe('1');
      if (doc2) {
        expect(doc2.topLevelDiagrams.length).toBe(1);
        expect(doc2.topLevelDiagrams[0].name).toBe('1');
      }

      // Act
      doc1.topLevelDiagrams[0].name = 'new-test-name';

      // Verify
      expect(doc1.topLevelDiagrams[0].name).toBe('new-test-name');
      if (doc2) {
        expect(doc2.topLevelDiagrams[0].name).toBe('new-test-name');
      }
    });
  });

  describe('toJSON', () => {
    it('should correctly serialize to JSON', () => {
      const doc = TestModel.newDocument();
      const diagram = new Diagram('test-id', 'test-name', doc);
      const json = diagram.toJSON();

      expect(json).toEqual({
        props: diagram.props,
        selectionState: diagram.selectionState,
        id: diagram.id,
        name: diagram.name,
        layers: diagram.layers
      });
    });
  });

  describe('props', () => {
    it('should initialize with empty props', () => {
      // Setup
      const { doc1, doc2 } = standardTestModel(backend);

      // Verify
      expect(doc1.topLevelDiagrams[0].props).toEqual({});
      if (doc2) expect(doc2.topLevelDiagrams[0].props).toEqual({});
    });

    it('should update props correctly', () => {
      // Setup
      const { doc1, doc2 } = standardTestModel(backend);

      const diagram = doc1.topLevelDiagrams[0];

      // Act
      diagram.updateProps(props => {
        props.grid ??= {};
        props.grid.enabled = false;
      });

      // Verify
      expect(diagram.props).toEqual({ grid: { enabled: false } });
      if (doc2) {
        expect(doc2.topLevelDiagrams[0].props).toEqual({ grid: { enabled: false } });
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
        expect(doc2.topLevelDiagrams[0].props).toEqual({
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

      const diagram = doc1.topLevelDiagrams[0];

      // Act
      diagram.canvas = { x: 100, y: 100, w: 100, h: 100 };
      expect(diagram.canvas).toEqual({ x: 100, y: 100, w: 100, h: 100 });
      if (doc2) {
        expect(doc2.topLevelDiagrams[0].canvas).toEqual({ x: 100, y: 100, w: 100, h: 100 });
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
      const node1 = DiagramNode.create('1', 'rect', bounds, layer1, {}, {});
      const node2 = DiagramNode.create('2', 'rect', bounds, layer2, {}, {});
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

      const node1 = DiagramNode.create('1', 'rect', bounds, layer, {}, {});
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
});
