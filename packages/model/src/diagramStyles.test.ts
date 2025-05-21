/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest';
import { Stylesheet } from './diagramStyles';
import { StylesheetSnapshot, UnitOfWork } from './unitOfWork';

describe('Stylesheet', () => {
  describe('from', () => {
    it('should create a new Stylesheet instance with the from static method', () => {
      const type = 'node';
      const id = '123';
      const name = 'Test stylesheet';
      const props = { color: 'blue' };

      const stylesheet = Stylesheet.from(type, id, name, props);

      expect(stylesheet.id).toBe(id);
      expect(stylesheet.name).toBe(name);
      expect(stylesheet.props).toEqual(props);
      expect(stylesheet.type).toBe(type);
    });
  });

  describe('setProps', () => {
    it('should set new props', () => {
      const type = 'node';
      const id = '123';
      const name = 'Test stylesheet';
      const initialProps = { color: 'blue' };

      const newProps = { color: 'red' } as any;

      const stylesheet = Stylesheet.from(type, id, name, initialProps);

      stylesheet.setProps(newProps, UnitOfWork.immediate(null!));

      expect(stylesheet.props).toEqual(newProps);
    });
  });

  describe('setName', () => {
    it('should set a new name', () => {
      const type = 'node';
      const id = '123';
      const name = 'Old Name';
      const newName = 'New Name';
      const props = { color: 'blue' };

      const stylesheet = Stylesheet.from(type, id, name, props);

      stylesheet.setName(newName, UnitOfWork.immediate(null!));

      expect(stylesheet.name).toBe(newName);
    });
  });

  describe('snapshot', () => {
    it('should return a valid snapshot', () => {
      const type = 'node';
      const id = '123';
      const name = 'Snapshot Test';
      const props = { color: 'blue' };

      const stylesheet = Stylesheet.from(type, id, name, props);
      const snapshot = stylesheet.snapshot();

      expect(snapshot).toEqual({
        _snapshotType: 'stylesheet',
        id,
        name,
        props: { color: 'blue' },
        type
      });
    });
  });

  describe('restore', () => {
    it('should restore from snapshot', () => {
      const type = 'node';
      const id = '123';
      const name = 'Initial Name';
      const props = { color: 'blue' };
      const snapshot = {
        _snapshotType: 'stylesheet',
        id,
        name: 'Restored Name',
        props: { color: 'red' },
        type
      } satisfies StylesheetSnapshot;

      const stylesheet = Stylesheet.from(type, id, name, props);

      stylesheet.restore(snapshot, UnitOfWork.immediate(null!));

      expect(stylesheet.name).toBe('Restored Name');
      expect(stylesheet.props).toEqual({ color: 'red' });
    });
  });
});
