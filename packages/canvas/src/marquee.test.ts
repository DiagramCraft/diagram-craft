import { describe, expect, test, vi } from 'vitest';
import { Marquee } from './marquee';
import { TestModel } from '@diagram-craft/model/test-support/testModel';

describe('Marquee', () => {
  describe('bounds', () => {
    test('can set and get bounds', () => {
      const marquee = new Marquee();
      const bounds = { x: 0, y: 0, w: 100, h: 100, r: 0 };

      marquee.bounds = bounds;

      expect(marquee.bounds).toEqual(bounds);
    });

    test('emits change event when bounds are set', async () => {
      const marquee = new Marquee();
      const listener = vi.fn();

      marquee.on('change', listener);

      marquee.bounds = { x: 0, y: 0, w: 100, h: 100, r: 0 };

      await vi.waitFor(() => {
        expect(listener).toHaveBeenCalledWith({ marquee });
      });
    });

    test('can set bounds to undefined', () => {
      const marquee = new Marquee();
      marquee.bounds = { x: 0, y: 0, w: 100, h: 100, r: 0 };

      marquee.bounds = undefined;

      expect(marquee.bounds).toBeUndefined();
    });
  });

  describe('pendingElements', () => {
    test('can set and get pending elements', () => {
      const marquee = new Marquee();
      const { layer } = TestModel.newDiagramWithLayer();
      const node1 = layer.addNode();
      const node2 = layer.addNode();

      marquee.pendingElements = [node1, node2];

      expect(marquee.pendingElements).toEqual([node1, node2]);
    });
  });

  describe('clear', () => {
    test('clears both bounds and pending elements', () => {
      const marquee = new Marquee();
      const { layer } = TestModel.newDiagramWithLayer();
      const node = layer.addNode();

      marquee.bounds = { x: 0, y: 0, w: 100, h: 100, r: 0 };
      marquee.pendingElements = [node];

      marquee.clear();

      expect(marquee.bounds).toBeUndefined();
      expect(marquee.pendingElements).toBeUndefined();
    });
  });

  describe('commitSelection', () => {
    test('adds pending elements to selection', () => {
      const marquee = new Marquee();
      const { diagram, layer } = TestModel.newDiagramWithLayer();
      const node1 = layer.addNode();
      const node2 = layer.addNode();

      marquee.pendingElements = [node1, node2];

      marquee.commitSelection(diagram.selection);

      expect(diagram.selection.elements).toContain(node1);
      expect(diagram.selection.elements).toContain(node2);
    });

    test('preserves existing selection elements', () => {
      const marquee = new Marquee();
      const { diagram, layer } = TestModel.newDiagramWithLayer();
      const node1 = layer.addNode();
      const node2 = layer.addNode();
      const node3 = layer.addNode();

      diagram.selection.setElements([node1]);
      marquee.pendingElements = [node2, node3];

      marquee.commitSelection(diagram.selection);

      expect(diagram.selection.elements).toContain(node1);
      expect(diagram.selection.elements).toContain(node2);
      expect(diagram.selection.elements).toContain(node3);
      expect(diagram.selection.elements).toHaveLength(3);
    });

    test('avoids duplicates when pending element already in selection', () => {
      const marquee = new Marquee();
      const { diagram, layer } = TestModel.newDiagramWithLayer();
      const node1 = layer.addNode();
      const node2 = layer.addNode();

      diagram.selection.setElements([node1]);
      marquee.pendingElements = [node1, node2];

      marquee.commitSelection(diagram.selection);

      expect(diagram.selection.elements).toHaveLength(2);
      expect(diagram.selection.elements.filter(e => e === node1)).toHaveLength(1);
    });

    test('clears marquee after committing selection', () => {
      const marquee = new Marquee();
      const { diagram, layer } = TestModel.newDiagramWithLayer();
      const node = layer.addNode();

      marquee.bounds = { x: 0, y: 0, w: 100, h: 100, r: 0 };
      marquee.pendingElements = [node];

      marquee.commitSelection(diagram.selection);

      expect(marquee.bounds).toBeUndefined();
      expect(marquee.pendingElements).toBeUndefined();
    });

    test('throws when pendingElements is undefined', () => {
      const marquee = new Marquee();
      const { diagram } = TestModel.newDiagramWithLayer();

      expect(() => {
        marquee.commitSelection(diagram.selection);
      }).toThrow();
    });
  });
});
