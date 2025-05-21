import { describe, expect, it } from 'vitest';
import { createSyncedYJSCRDTs, setupYJS } from './yjsTest';
import { Stylesheet } from '../../diagramStyles';
import { CRDTMap } from '../crdt';
import { UnitOfWork } from '../../unitOfWork';

describe('YJS Stylesheet', () => {
  setupYJS();

  describe('from', () => {
    it('should create a new Stylesheet instance with the from static method', () => {
      const { doc1, doc2 } = createSyncedYJSCRDTs();

      const type = 'node';
      const id = '123';
      const name = 'Test stylesheet';
      const props = { color: 'blue' };

      const stylesheet = Stylesheet.from(type, id, name, props);
      doc1.getMap('test').set('test', stylesheet.crdt);

      const other = new Stylesheet(type, doc2.getMap('test').get('test') as CRDTMap);
      expect(other.id).toBe(id);
      expect(other.name).toBe(name);
      expect(other.props).toEqual(props);
      expect(other.type).toBe(type);
    });
  });

  describe('setProps', () => {
    it('should set new props', () => {
      const { doc1, doc2 } = createSyncedYJSCRDTs();

      const stylesheet = new Stylesheet('node', doc1.getMap('test'));
      const other = new Stylesheet('node', doc2.getMap('test'));

      const newProps = { color: 'red' } as any;
      stylesheet.setProps(newProps, UnitOfWork.immediate(null!));

      expect(other.props).toEqual(newProps);
    });
  });

  describe('setName', () => {
    it('should set a new name', () => {
      const { doc1, doc2 } = createSyncedYJSCRDTs();

      const stylesheet = new Stylesheet('node', doc1.getMap('test'));
      const other = new Stylesheet('node', doc2.getMap('test'));

      stylesheet.setName('New Name', UnitOfWork.immediate(null!));

      expect(other.name).toBe('New Name');
    });
  });
});
