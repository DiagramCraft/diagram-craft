import { describe, expect, it, vi } from 'vitest';
import { standardTestModel } from './test-support/collaborationModelTestUtils';
import { Backends } from '@diagram-craft/collaboration/test-support/collaborationTestUtils';

describe.each(Backends.all())('DiagramViewManager [%s]', (_name, backend) => {
  describe('all', () => {
    it('should return all views in insertion order', () => {
      const { diagram1 } = standardTestModel(backend);

      const first = diagram1.views.add('First');
      const second = diagram1.views.add('Second');

      expect(diagram1.views.all).toEqual([first, second]);
    });
  });

  describe('byId', () => {
    it('should return the correct view by id', () => {
      const { diagram1 } = standardTestModel(backend);
      const view = diagram1.views.add('Focused');

      expect(diagram1.views.byId(view.id)).toEqual(view);
    });

    it('should return undefined when the view does not exist', () => {
      const { diagram1 } = standardTestModel(backend);

      expect(diagram1.views.byId('missing')).toBeUndefined();
    });
  });

  describe('add', () => {
    it('should add a new view and sync it through CRDT', () => {
      const { diagram1, diagram2 } = standardTestModel(backend);
      const events = [vi.fn(), vi.fn()];

      diagram1.views.on('viewAdded', events[0]!);
      diagram2?.views.on('viewAdded', events[1]!);

      const view = diagram1.views.add('Focused');

      expect(diagram1.views.all).toEqual([
        {
          id: view.id,
          name: 'Focused',
          layers: [diagram1.activeLayer.id]
        }
      ]);
      expect(events[0]).toHaveBeenCalledTimes(1);

      if (diagram2) {
        expect(diagram2.views.all).toEqual([
          {
            id: view.id,
            name: 'Focused',
            layers: [diagram2.activeLayer.id]
          }
        ]);
        expect(events[1]).toHaveBeenCalledTimes(1);
      }
    });
  });

  describe('remove', () => {
    it('should remove a view and sync the deletion through CRDT', () => {
      const { diagram1, diagram2 } = standardTestModel(backend);
      const view = diagram1.views.add('Focused');
      const events = [vi.fn(), vi.fn()];

      diagram1.views.on('viewRemoved', events[0]!);
      diagram2?.views.on('viewRemoved', events[1]!);

      const removed = diagram1.views.remove(view.id);

      expect(removed).toBe(true);
      expect(diagram1.views.all).toEqual([]);
      expect(events[0]).toHaveBeenCalledTimes(1);

      if (diagram2) {
        expect(diagram2.views.all).toEqual([]);
        expect(events[1]).toHaveBeenCalledTimes(1);
      }
    });

    it('should return false when removing a missing view', () => {
      const { diagram1 } = standardTestModel(backend);

      expect(diagram1.views.remove('missing')).toBe(false);
    });
  });

  describe('viewChange', () => {
    it('should emit viewChange on add and remove', () => {
      const { diagram1 } = standardTestModel(backend);
      const listener = vi.fn();

      diagram1.views.on('viewChange', listener);

      const view = diagram1.views.add('Focused');
      diagram1.views.remove(view.id);

      expect(listener).toHaveBeenCalledTimes(2);
    });
  });
});
