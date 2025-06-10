import { describe, expect, it } from 'vitest';
import { createSyncedYJSCRDTs, setupYJS } from './yjsTest';
import { DiagramStyles, Stylesheet } from '../../diagramStyles';
import { StylesheetSnapshot, UnitOfWork } from '../../unitOfWork';
import { TestModel } from '../../test-support/builder';

describe('YJS Stylesheet', () => {
  setupYJS();

  describe('from', () => {
    it('should create a new Stylesheet instance with the from static method', () => {
      const { doc1, doc2 } = createSyncedYJSCRDTs();

      const type = 'node';
      const id = '123';
      const name = 'Test stylesheet';
      const props = { fill: { color: 'blue' } };

      const stylesheet = new Stylesheet(type, { id, name, props });
      doc1.getMap<Record<string, StylesheetSnapshot>>('test').set('test', stylesheet.snapshot());

      const other = new Stylesheet(
        type,
        doc2.getMap<Record<string, StylesheetSnapshot>>('test').get('test') as StylesheetSnapshot
      );
      expect(other.id).toBe(id);
      expect(other.name).toBe(name);
      expect(other.props).toEqual(props);
      expect(other.type).toBe(type);
    });
  });

  describe('setProps', () => {
    it('should set new props', () => {
      const { doc1, doc2 } = createSyncedYJSCRDTs();

      const type = 'node';
      const id = '123';
      const name = 'Test stylesheet';
      const props = { fill: { color: 'blue' } };

      const stylesheet = new Stylesheet(type, { id, name, props });

      const styles1 = new DiagramStyles(doc1, TestModel.newDocument(), true);
      styles1.addStylesheet(id, stylesheet);

      const styles2 = new DiagramStyles(doc2, TestModel.newDocument(), true);

      expect(styles2.getNodeStyle('123')!.props!.fill!.color).toEqual('blue');

      const newProps = { fill: { color: 'red' } };
      stylesheet.setProps(newProps, styles1, UnitOfWork.immediate(null!));

      expect(styles2.getNodeStyle('123')!.props!.fill!.color).toEqual('red');
    });
  });

  describe('setName', () => {
    it('should set a new name', () => {
      const { doc1, doc2 } = createSyncedYJSCRDTs();

      const type = 'node';
      const id = '123';
      const name = 'Test stylesheet';
      const props = { fill: { color: 'blue' } };

      const stylesheet = new Stylesheet(type, { id, name, props });

      const styles1 = new DiagramStyles(doc1, TestModel.newDocument(), true);
      styles1.addStylesheet(id, stylesheet);

      const styles2 = new DiagramStyles(doc2, TestModel.newDocument(), true);

      expect(styles2.getNodeStyle('123')!.name).toBe(name);

      stylesheet.setName('New Name', styles1, UnitOfWork.immediate(null!));

      expect(styles2.getNodeStyle('123')!.name).toBe('New Name');
    });
  });
});

describe('YJS DiagramStyles', () => {
  setupYJS();

  describe('constructor', () => {
    it('should initialize with default styles when addDefaultStyles is true', () => {
      const { doc1, doc2 } = createSyncedYJSCRDTs();

      const styles1 = new DiagramStyles(doc1, TestModel.newDocument(), true);
      const styles2 = new DiagramStyles(doc2, TestModel.newDocument(), true);

      expect(styles1.nodeStyles.length).toBe(2);
      expect(styles1.edgeStyles.length).toBe(1);
      expect(styles1.textStyles.length).toBe(2);

      expect(styles2.nodeStyles.length).toBe(2);
      expect(styles2.edgeStyles.length).toBe(1);
      expect(styles2.textStyles.length).toBe(2);
    });
  });

  describe('activeNodeStylesheet', () => {
    it('should not be synced', () => {
      const { doc1, doc2 } = createSyncedYJSCRDTs();

      const styles1 = new DiagramStyles(doc1, TestModel.newDocument(), true);
      const styles2 = new DiagramStyles(doc2, TestModel.newDocument(), true);

      const customNodeStyle = new Stylesheet('node', { id: 'custom', name: 'Custom', props: {} });
      styles1.addStylesheet('custom', customNodeStyle);

      styles1.activeNodeStylesheet = customNodeStyle;

      expect(styles1.activeNodeStylesheet.id).toBe(customNodeStyle.id);
      expect(styles2.activeNodeStylesheet.id).toBe(styles2.nodeStyles[0].id);
    });
  });

  describe('activeEdgeStylesheet', () => {
    it('should not be synced', () => {
      const { doc1, doc2 } = createSyncedYJSCRDTs();

      const styles1 = new DiagramStyles(doc1, TestModel.newDocument(), true);
      const styles2 = new DiagramStyles(doc2, TestModel.newDocument(), true);

      const customEdgeStyle = new Stylesheet('edge', {
        id: 'custom-edge',
        name: 'Custom Edge',
        props: {}
      });
      styles1.addStylesheet('custom-edge', customEdgeStyle);

      styles1.activeEdgeStylesheet = customEdgeStyle;

      expect(styles1.activeEdgeStylesheet.id).toBe(customEdgeStyle.id);
      expect(styles2.activeEdgeStylesheet.id).toBe(styles2.edgeStyles[0].id);
    });
  });

  describe('activeTextStylesheet', () => {
    it('should not be synced', () => {
      const { doc1, doc2 } = createSyncedYJSCRDTs();

      const styles1 = new DiagramStyles(doc1, TestModel.newDocument(), true);
      const styles2 = new DiagramStyles(doc2, TestModel.newDocument(), true);

      const customTextStyle = new Stylesheet('text', { id: 'custom', name: 'Custom', props: {} });
      styles1.addStylesheet('custom', customTextStyle);

      styles1.activeTextStylesheet = customTextStyle;

      expect(styles1.activeTextStylesheet.id).toBe(customTextStyle.id);
      expect(styles2.activeTextStylesheet.id).toBe(styles2.textStyles[0].id);
    });
  });

  describe('addStylesheet', () => {
    it('should be synced', () => {
      const { doc1, doc2 } = createSyncedYJSCRDTs();

      const styles1 = new DiagramStyles(doc1, TestModel.newDocument(), true);
      const styles2 = new DiagramStyles(doc2, TestModel.newDocument(), true);

      const customTextStyle = new Stylesheet('text', { id: 'custom', name: 'Custom', props: {} });
      styles1.addStylesheet('custom', customTextStyle);

      expect(styles1.textStyles.length).toBe(3);
      expect(styles2.textStyles.length).toBe(3);
    });
  });

  describe('deleteStylesheet', () => {
    it('should be synced', () => {
      const { doc1, doc2 } = createSyncedYJSCRDTs();

      const styles1 = new DiagramStyles(doc1, TestModel.newDocument(), true);
      const styles2 = new DiagramStyles(doc2, TestModel.newDocument(), true);

      const customTextStyle = new Stylesheet('text', { id: 'custom', name: 'Custom', props: {} });
      styles1.addStylesheet('custom-text', customTextStyle);

      expect(styles1.textStyles.length).toBe(3);
      expect(styles2.textStyles.length).toBe(3);

      styles2.deleteStylesheet('custom-text', UnitOfWork.immediate(TestModel.newDiagram()));

      expect(styles1.textStyles.length).toBe(2);
      expect(styles2.textStyles.length).toBe(2);
    });
  });

  // TODO: Must be implemented
  // describe('setStylesheet', () => {});
});
