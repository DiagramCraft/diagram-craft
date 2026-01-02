import { describe, expect, it } from 'vitest';
import { TestModel } from './test-support/testModel';
import { UOW } from '@diagram-craft/model/uow';

describe('SpatialIndex', () => {
  describe('near', () => {
    it('returns elements closest to point first', () => {
      const diagram = TestModel.newDiagram();
      const layer = diagram.newLayer();

      const node1 = layer.addNode({ bounds: { x: 10, y: 10, w: 10, h: 10, r: 0 } });
      const node2 = layer.addNode({ bounds: { x: 50, y: 50, w: 10, h: 10, r: 0 } });
      const node3 = layer.addNode({ bounds: { x: 100, y: 100, w: 10, h: 10, r: 0 } });

      const results = Array.from(diagram.index.near({ x: 10, y: 10 }));

      expect(results[0]).toBe(node1);
      expect(results[1]).toBe(node2);
      expect(results[2]).toBe(node3);
    });

    it('handles box reference using center point', () => {
      const diagram = TestModel.newDiagram();
      const layer = diagram.newLayer();

      const node1 = layer.addNode({ bounds: { x: 10, y: 10, w: 10, h: 10, r: 0 } });
      const node2 = layer.addNode({ bounds: { x: 50, y: 50, w: 10, h: 10, r: 0 } });

      const results = Array.from(diagram.index.near({ x: 50, y: 50, w: 10, h: 10, r: 0 }));

      expect(results[0]).toBe(node2);
      expect(results[1]).toBe(node1);
    });

    it('does not yield duplicate elements when they span multiple cells', () => {
      const diagram = TestModel.newDiagram();
      const layer = diagram.newLayer();

      // Create a large node that spans multiple grid cells
      const largeNode = layer.addNode({ bounds: { x: 0, y: 0, w: 200, h: 200, r: 0 } });

      const results = Array.from(diagram.index.near({ x: 100, y: 100 }));

      expect(results.length).toBe(1);
      expect(results[0]).toBe(largeNode);
    });
  });

  describe('inDirection', () => {
    it('returns elements north of point', () => {
      const diagram = TestModel.newDiagram();
      const layer = diagram.newLayer();

      const north = layer.addNode({ bounds: { x: 50, y: 10, w: 10, h: 10, r: 0 } });

      const results = Array.from(diagram.index.inDirection({ x: 50, y: 50 }, 'n'));

      expect(results.length).toBe(1);
      expect(results[0]).toBe(north);
    });

    it('returns elements sorted by distance', () => {
      const diagram = TestModel.newDiagram();
      const layer = diagram.newLayer();

      const east1 = layer.addNode({ bounds: { x: 60, y: 50, w: 10, h: 10, r: 0 } });
      const east2 = layer.addNode({ bounds: { x: 100, y: 50, w: 10, h: 10, r: 0 } });
      const east3 = layer.addNode({ bounds: { x: 150, y: 50, w: 10, h: 10, r: 0 } });

      const results = Array.from(diagram.index.inDirection({ x: 50, y: 50 }, 'e'));

      expect(results[0]).toBe(east1);
      expect(results[1]).toBe(east2);
      expect(results[2]).toBe(east3);
    });
  });

  describe('cache invalidation', () => {
    it('invalidates cache when element is added', () => {
      const diagram = TestModel.newDiagram();
      const layer = diagram.newLayer();

      const node1 = layer.createNode({ bounds: { x: 10, y: 10, w: 10, h: 10, r: 0 } });
      UOW.execute(diagram, () => layer.addElement(node1, UOW.uow()));

      const results1 = Array.from(diagram.index.near({ x: 10, y: 10 }));
      expect(results1.length).toBe(1);

      const node2 = layer.createNode({ bounds: { x: 20, y: 20, w: 10, h: 10, r: 0 } });
      UOW.execute(diagram, () => layer.addElement(node2, UOW.uow()));

      const results2 = Array.from(diagram.index.near({ x: 10, y: 10 }));
      expect(results2.length).toBe(2);
    });

    it('invalidates cache when element is removed', () => {
      const diagram = TestModel.newDiagram();
      const layer = diagram.newLayer();

      const node1 = layer.addNode({ bounds: { x: 10, y: 10, w: 10, h: 10, r: 0 } });
      const node2 = layer.addNode({ bounds: { x: 20, y: 20, w: 10, h: 10, r: 0 } });

      const results1 = Array.from(diagram.index.near({ x: 10, y: 10 }));
      expect(results1.length).toBe(2);

      UOW.begin(diagram, { _noSnapshot: true });
      layer.removeElement(node2, UOW.uow());
      UOW.uow().commit();

      const results2 = Array.from(diagram.index.near({ x: 10, y: 10 }));
      expect(results2.length).toBe(1);
      expect(results2[0]).toBe(node1);
    });

    it('invalidates cache when element is changed', () => {
      const diagram = TestModel.newDiagram();
      const layer = diagram.newLayer();

      const node = layer.addNode({ bounds: { x: 10, y: 10, w: 10, h: 10, r: 0 } });

      const results1 = Array.from(diagram.index.near({ x: 10, y: 10 }));
      expect(results1[0]).toBe(node);

      UOW.execute(diagram, () => node.setBounds({ x: 100, y: 100, w: 10, h: 10, r: 0 }, UOW.uow()));

      const results2 = Array.from(diagram.index.near({ x: 100, y: 100 }));
      expect(results2[0]).toBe(node);

      const results3 = Array.from(diagram.index.near({ x: 10, y: 10 }));
      expect(results3.length).toBe(1);
      expect(results3[0]).toBe(node);
    });
  });

  describe('with RegularLayer', () => {
    it('works with layer as source', () => {
      const diagram = TestModel.newDiagram();
      const layer = diagram.newLayer();

      const node1 = layer.addNode({ bounds: { x: 10, y: 10, w: 10, h: 10, r: 0 } });
      const node2 = layer.addNode({ bounds: { x: 50, y: 50, w: 10, h: 10, r: 0 } });

      const results = Array.from(layer.index.near({ x: 10, y: 10 }));

      expect(results[0]).toBe(node1);
      expect(results[1]).toBe(node2);
    });
  });
});
