/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it } from 'vitest';
import { DiagramStyles, getCommonProps, Stylesheet } from './diagramStyles';
import { StylesheetSnapshot, UnitOfWork } from './unitOfWork';
import { NoOpCRDTFactory } from './collaboration/noopCrdt';
import { DiagramDocument } from './diagramDocument';
import { TestModel } from './test-support/builder';
import type { CRDTRoot } from './collaboration/crdt';
import { Backends } from './collaboration/collaborationTestUtils';

describe.each(Backends.all())('Stylesheet [%s]', (_name, backend) => {
  describe('from', () => {
    it('should create a new Stylesheet instance with the from static method', () => {
      const type = 'node';
      const id = '123';
      const name = 'Test stylesheet';
      const props: NodeProps = { fill: { color: 'blue' } };

      const stylesheet = Stylesheet.fromSnapshot(type, { id, name, props }, new NoOpCRDTFactory());

      expect(stylesheet.id).toBe(id);
      expect(stylesheet.name).toBe(name);
      expect(stylesheet.props).toEqual(props);
      expect(stylesheet.type).toBe(type);
    });
  });

  describe('setProps', () => {
    it('should set new props', () => {
      // Setup
      const [root1, root2] = backend.syncedDocs();

      const type = 'node';
      const id = '123';
      const name = 'Test stylesheet';
      const initialProps = { fill: { color: 'blue' } };

      const styles1 = new DiagramStyles(root1, TestModel.newDocument(), true);
      const styles2 = root2 ? new DiagramStyles(root2, TestModel.newDocument(), true) : undefined;

      const stylesheet = Stylesheet.fromSnapshot(
        type,
        { id, name, props: initialProps },
        styles1.crdt.factory
      );
      styles1.addStylesheet(id, stylesheet);

      // Act
      const newProps = { fill: { color: 'red' } };
      stylesheet.setProps(newProps, styles1, UnitOfWork.immediate(null!));

      // Verify
      expect(stylesheet.props).toEqual(newProps);
      if (styles2) {
        expect(styles2.getNodeStyle('123')!.props!.fill!.color).toEqual('red');
      }
    });
  });

  describe('setName', () => {
    it('should set a new name', () => {
      // Setup
      const [root1, root2] = backend.syncedDocs();

      const type = 'node';
      const id = '123';
      const name = 'Old Name';
      const newName = 'New Name';
      const props = { fill: { color: 'blue' } };

      const styles1 = new DiagramStyles(root1, TestModel.newDocument(), true);
      const stylesheet = Stylesheet.fromSnapshot(type, { id, name, props }, styles1.crdt.factory);
      styles1.addStylesheet(id, stylesheet);

      const styles2 = root2 ? new DiagramStyles(root2, TestModel.newDocument(), true) : undefined;

      // Act
      stylesheet.setName(newName, styles1, UnitOfWork.immediate(null!));

      expect(stylesheet.name).toBe(newName);
      if (styles2) {
        expect(styles2.getNodeStyle('123')!.name).toBe(newName);
      }
    });
  });

  describe('snapshot', () => {
    it('should return a valid snapshot', () => {
      const type = 'node';
      const id = '123';
      const name = 'Snapshot Test';
      const props = { fill: { color: 'blue' } };

      const stylesheet = Stylesheet.fromSnapshot(type, { id, name, props }, new NoOpCRDTFactory());
      const snapshot = stylesheet.snapshot();

      expect(snapshot).toEqual({
        _snapshotType: 'stylesheet',
        id,
        name,
        props: { fill: { color: 'blue' } },
        type
      });
    });
  });

  describe('restore', () => {
    it('should restore from snapshot', () => {
      const type = 'node';
      const id = '123';
      const name = 'Initial Name';
      const props = { fill: { color: 'blue' } };
      const snapshot = {
        _snapshotType: 'stylesheet',
        id,
        name: 'Restored Name',
        props: { fill: { color: 'red' } },
        type
      } satisfies StylesheetSnapshot;

      const stylesheet = Stylesheet.fromSnapshot(type, { id, name, props }, new NoOpCRDTFactory());

      stylesheet.restore(snapshot, UnitOfWork.immediate(null!));

      expect(stylesheet.name).toBe('Restored Name');
      expect(stylesheet.props).toEqual({ fill: { color: 'red' } });
    });
  });
});

describe('getCommonProps', () => {
  it('should return common properties from a non-empty array', () => {
    const input = [
      { color: 'blue', size: 'large' },
      { color: 'blue', shape: 'circle' }
    ];
    const result = getCommonProps(input);
    expect(result).toEqual({ color: 'blue' });
  });

  it('should return an empty object if there are no common properties', () => {
    const input = [{ color: 'blue' }, { shape: 'circle' }];
    const result = getCommonProps(input);
    expect(result).toEqual({});
  });

  it('should return an empty object when the array is empty', () => {
    const input: Array<Record<string, unknown>> = [];
    const result = getCommonProps(input);
    expect(result).toEqual({});
  });

  it('should return the first element if the array has only one object', () => {
    const input = [{ color: 'blue', size: 'large' }];
    const result = getCommonProps(input);
    expect(result).toEqual({ color: 'blue', size: 'large' });
  });
});

describe.each(Backends.all())('DiagramStyles [%s]', (_name, backend) => {
  let root: CRDTRoot;
  let document: DiagramDocument;

  beforeEach(() => {
    root = backend.syncedDocs()[0];
    document = TestModel.newDocument();
  });

  describe('constructor', () => {
    it('should initialize with default styles when addDefaultStyles is true', () => {
      // Setup
      const [root1, root2] = backend.syncedDocs();

      // Act
      const styles1 = new DiagramStyles(root1, document, true);
      const styles2 = root2 ? new DiagramStyles(root2, document, true) : undefined;

      // Verify
      expect(styles1.nodeStyles.length).toBeGreaterThan(0);
      expect(styles1.edgeStyles.length).toBeGreaterThan(0);
      expect(styles1.textStyles.length).toBeGreaterThan(0);
      if (styles2) {
        expect(styles2.nodeStyles.length).toBeGreaterThan(0);
        expect(styles2.edgeStyles.length).toBeGreaterThan(0);
        expect(styles2.textStyles.length).toBeGreaterThan(0);
      }
    });

    it('should not add default styles when addDefaultStyles is false', () => {
      const styles = new DiagramStyles(root, document, false);
      expect(styles.nodeStyles.length).toBe(0);
      expect(styles.edgeStyles.length).toBe(0);
      expect(styles.textStyles.length).toBe(0);
    });
  });

  describe('nodeStyles', () => {
    it('should return all node styles', () => {
      const styles = new DiagramStyles(root, document, true);
      const nodeStyles = styles.nodeStyles;
      expect(nodeStyles.length).toBeGreaterThan(0);
      expect(nodeStyles[0]!.type).toBe('node');
    });
  });

  describe('edgeStyles', () => {
    it('should return all edge styles', () => {
      const styles = new DiagramStyles(root, document, true);
      const edgeStyles = styles.edgeStyles;
      expect(edgeStyles.length).toBeGreaterThan(0);
      expect(edgeStyles[0]!.type).toBe('edge');
    });
  });

  describe('textStyles', () => {
    it('should return all text styles', () => {
      const styles = new DiagramStyles(root, document, true);
      const textStyles = styles.textStyles;
      expect(textStyles.length).toBeGreaterThan(0);
      expect(textStyles[0]!.type).toBe('text');
    });
  });

  describe('activeNodeStylesheet', () => {
    it('should not be synced', () => {
      const [root1, root2] = backend.syncedDocs();

      const styles1 = new DiagramStyles(root1, TestModel.newDocument(), true);

      if (root2) {
        const styles2 = new DiagramStyles(root2, TestModel.newDocument(), true);

        const customNodeStyle = Stylesheet.fromSnapshot(
          'node',
          {
            id: 'custom',
            name: 'Custom',
            props: {}
          },
          styles1.crdt.factory
        );
        styles1.addStylesheet('custom', customNodeStyle);

        styles1.activeNodeStylesheet = customNodeStyle;

        expect(styles1.activeNodeStylesheet.id).toBe(customNodeStyle.id);
        expect(styles2.activeNodeStylesheet.id).toBe(styles2.nodeStyles[0]!.id);
      }
    });

    it('should return the active node stylesheet', () => {
      const styles = new DiagramStyles(root, document, true);
      const activeNodeStyle = styles.activeNodeStylesheet;
      expect(activeNodeStyle.type).toBe('node');
      expect(activeNodeStyle.id).toBe(styles.nodeStyles[0]!.id);
    });

    it('should set the active node stylesheet', () => {
      const styles = new DiagramStyles(root, document, true);
      const customNodeStyle = Stylesheet.fromSnapshot(
        'node',
        {
          id: 'custom-node',
          name: 'Custom Node',
          props: {}
        },
        styles.crdt.factory
      );
      styles.addStylesheet('custom-node', customNodeStyle);

      styles.activeNodeStylesheet = customNodeStyle;
      expect(styles.activeNodeStylesheet.id).toBe('custom-node');
    });
  });

  describe('activeEdgeStylesheet', () => {
    it('should not be synced', () => {
      const [root1, root2] = backend.syncedDocs();

      if (root2) {
        const styles1 = new DiagramStyles(root1, TestModel.newDocument(), true);
        const styles2 = new DiagramStyles(root2, TestModel.newDocument(), true);

        const customEdgeStyle = Stylesheet.fromSnapshot(
          'edge',
          {
            id: 'custom-edge',
            name: 'Custom Edge',
            props: {}
          },
          styles1.crdt.factory
        );
        styles1.addStylesheet('custom-edge', customEdgeStyle);

        styles1.activeEdgeStylesheet = customEdgeStyle;

        expect(styles1.activeEdgeStylesheet.id).toBe(customEdgeStyle.id);
        expect(styles2.activeEdgeStylesheet.id).toBe(styles2.edgeStyles[0]!.id);
      }
    });

    it('should return the active edge stylesheet', () => {
      const styles = new DiagramStyles(root, document, true);
      const activeEdgeStyle = styles.activeEdgeStylesheet;
      expect(activeEdgeStyle.type).toBe('edge');
      expect(activeEdgeStyle.id).toBe(styles.edgeStyles[0]!.id);
    });

    it('should set the active edge stylesheet', () => {
      const styles = new DiagramStyles(root, document, true);
      const customEdgeStyle = Stylesheet.fromSnapshot(
        'edge',
        {
          id: 'custom-edge',
          name: 'Custom Edge',
          props: {}
        },
        styles.crdt.factory
      );
      styles.addStylesheet('custom-edge', customEdgeStyle);

      styles.activeEdgeStylesheet = customEdgeStyle;
      expect(styles.activeEdgeStylesheet.id).toBe('custom-edge');
    });
  });

  describe('activeTextStylesheet', () => {
    it('should not be synced', () => {
      const [root1, root2] = backend.syncedDocs();

      if (root2) {
        const styles1 = new DiagramStyles(root1, TestModel.newDocument(), true);
        const styles2 = new DiagramStyles(root2, TestModel.newDocument(), true);

        const customTextStyle = Stylesheet.fromSnapshot(
          'text',
          {
            id: 'custom',
            name: 'Custom',
            props: {}
          },
          styles1.crdt.factory
        );
        styles1.addStylesheet('custom', customTextStyle);

        styles1.activeTextStylesheet = customTextStyle;

        expect(styles1.activeTextStylesheet.id).toBe(customTextStyle.id);
        expect(styles2.activeTextStylesheet.id).toBe(styles2.textStyles[0]!.id);
      }
    });

    it('should return the active text stylesheet', () => {
      const styles = new DiagramStyles(root, document, true);
      const activeTextStyle = styles.activeTextStylesheet;
      expect(activeTextStyle.type).toBe('text');
      expect(activeTextStyle.id).toBe(styles.textStyles[0]!.id);
    });

    it('should set the active text stylesheet', () => {
      const styles = new DiagramStyles(root, document, true);
      const customTextStyle = Stylesheet.fromSnapshot(
        'text',
        {
          id: 'custom-text',
          name: 'Custom Text',
          props: {}
        },
        styles.crdt.factory
      );
      styles.addStylesheet('custom-text', customTextStyle);

      styles.activeTextStylesheet = customTextStyle;
      expect(styles.activeTextStylesheet.id).toBe('custom-text');
    });
  });

  describe('get', () => {
    it('should get a stylesheet by id', () => {
      const styles = new DiagramStyles(root, document, true);

      const defaultNodeStyleId = styles.nodeStyles[0]!.id;
      const nodeStyle = styles.get(defaultNodeStyleId);
      expect(nodeStyle).toBeDefined();
      expect(nodeStyle?.type).toBe('node');
      expect(nodeStyle?.id).toBe(defaultNodeStyleId);

      const defaultEdgeStyleId = styles.edgeStyles[0]!.id;
      const edgeStyle = styles.get(defaultEdgeStyleId);
      expect(edgeStyle).toBeDefined();
      expect(edgeStyle?.type).toBe('edge');
      expect(edgeStyle?.id).toBe(defaultEdgeStyleId);

      const defaultTextStyleId = styles.textStyles[0]!.id;
      const textStyle = styles.get(defaultTextStyleId);
      expect(textStyle).toBeDefined();
      expect(textStyle?.type).toBe('text');
      expect(textStyle?.id).toBe(defaultTextStyleId);
    });

    it('should return undefined for non-existent stylesheet id', () => {
      const styles = new DiagramStyles(root, document, true);

      const nonExistentStyle = styles.get('non-existent-id');
      expect(nonExistentStyle).toBeUndefined();
    });
  });

  describe('getNodeStyle', () => {
    it('should get a node stylesheet by id', () => {
      const styles = new DiagramStyles(root, document, true);

      const defaultNodeStyleId = styles.nodeStyles[0]!.id;
      const nodeStyle = styles.getNodeStyle(defaultNodeStyleId);
      expect(nodeStyle).toBeDefined();
      expect(nodeStyle?.type).toBe('node');
      expect(nodeStyle?.id).toBe(defaultNodeStyleId);
    });
  });

  describe('getEdgeStyle', () => {
    it('should get an edge stylesheet by id', () => {
      const styles = new DiagramStyles(root, document, true);

      const defaultEdgeStyleId = styles.edgeStyles[0]!.id;
      const edgeStyle = styles.getEdgeStyle(defaultEdgeStyleId);
      expect(edgeStyle).toBeDefined();
      expect(edgeStyle?.type).toBe('edge');
      expect(edgeStyle?.id).toBe(defaultEdgeStyleId);
    });
  });

  describe('getTextStyle', () => {
    it('should get a text stylesheet by id', () => {
      const styles = new DiagramStyles(root, document, true);

      const defaultTextStyleId = styles.textStyles[0]!.id;
      const textStyle = styles.getTextStyle(defaultTextStyleId);
      expect(textStyle).toBeDefined();
      expect(textStyle?.type).toBe('text');
      expect(textStyle?.id).toBe(defaultTextStyleId);
    });
  });

  describe('addStylesheet', () => {
    it('should add a new node stylesheet', () => {
      // Setup
      const [root1, root2] = backend.syncedDocs();

      const styles1 = new DiagramStyles(root1, TestModel.newDocument(), true);
      const styles2 = root2 ? new DiagramStyles(root2, TestModel.newDocument(), true) : undefined;

      // Act
      const customNodeStyle = Stylesheet.fromSnapshot(
        'node',
        {
          id: 'custom-node',
          name: 'Custom Node',
          props: {}
        },
        styles1.crdt.factory
      );
      styles1.addStylesheet('custom-node', customNodeStyle);

      // Verify
      const retrievedStyle = styles1.getNodeStyle('custom-node');
      expect(retrievedStyle).toBeDefined();
      expect(retrievedStyle?.id).toBe('custom-node');
      expect(retrievedStyle?.name).toBe('Custom Node');
      expect(retrievedStyle?.type).toBe('node');
      if (styles2) {
        const retrievedStyle2 = styles2.getNodeStyle('custom-node');
        expect(retrievedStyle2).toBeDefined();
        expect(retrievedStyle2?.id).toBe('custom-node');
        expect(retrievedStyle2?.name).toBe('Custom Node');
        expect(retrievedStyle2?.type).toBe('node');
      }
    });

    it('should add a new edge stylesheet', () => {
      const styles = new DiagramStyles(root, document, true);

      const customEdgeStyle = Stylesheet.fromSnapshot(
        'edge',
        {
          id: 'custom-edge',
          name: 'Custom Edge',
          props: {}
        },
        styles.crdt.factory
      );
      styles.addStylesheet('custom-edge', customEdgeStyle);

      const retrievedStyle = styles.getEdgeStyle('custom-edge');
      expect(retrievedStyle).toBeDefined();
      expect(retrievedStyle?.id).toBe('custom-edge');
      expect(retrievedStyle?.name).toBe('Custom Edge');
      expect(retrievedStyle?.type).toBe('edge');
    });

    it('should add a new text stylesheet', () => {
      const styles = new DiagramStyles(root, document, true);

      const customTextStyle = Stylesheet.fromSnapshot(
        'text',
        {
          id: 'custom-text',
          name: 'Custom Text',
          props: {}
        },
        styles.crdt.factory
      );
      styles.addStylesheet('custom-text', customTextStyle);

      const retrievedStyle = styles.getTextStyle('custom-text');
      expect(retrievedStyle).toBeDefined();
      expect(retrievedStyle?.id).toBe('custom-text');
      expect(retrievedStyle?.name).toBe('Custom Text');
      expect(retrievedStyle?.type).toBe('text');
    });

    it('should set the active stylesheet when adding a new stylesheet', () => {
      const styles = new DiagramStyles(root, document, true);

      const customNodeStyle = Stylesheet.fromSnapshot(
        'node',
        {
          id: 'custom-node',
          name: 'Custom Node',
          props: {}
        },
        styles.crdt.factory
      );
      styles.addStylesheet('custom-node', customNodeStyle);

      expect(styles.activeNodeStylesheet.id).toBe('custom-node');
    });
  });

  describe('deleteStylesheet', () => {
    it('should delete a custom stylesheet', () => {
      // Setup
      const [root1, root2] = backend.syncedDocs();

      const styles1 = new DiagramStyles(root1, TestModel.newDocument(), true);
      const styles2 = root2 ? new DiagramStyles(root2, TestModel.newDocument(), true) : undefined;

      const customNodeStyle = Stylesheet.fromSnapshot(
        'node',
        {
          id: 'custom-node',
          name: 'Custom Node',
          props: {}
        },
        styles1.crdt.factory
      );
      styles1.addStylesheet('custom-node', customNodeStyle);

      // Act
      styles1.deleteStylesheet('custom-node', UnitOfWork.immediate(document.diagrams[0]!));

      // Verify
      expect(styles1.getNodeStyle('custom-node')).toBeUndefined();
      if (styles2) {
        expect(styles2.getNodeStyle('custom-node')).toBeUndefined();
      }
    });

    it('should not delete a default stylesheet', () => {
      const styles = new DiagramStyles(root, document, true);

      // Get the default node stylesheet ID
      const defaultNodeStyleId = styles.nodeStyles[0]!.id;

      // Try to delete the default node stylesheet
      styles.deleteStylesheet(defaultNodeStyleId, UnitOfWork.immediate(document.diagrams[0]!));

      // Verify it was not deleted
      expect(styles.getNodeStyle(defaultNodeStyleId)).toBeDefined();
    });

    it('should update active stylesheet when deleting the active stylesheet', () => {
      const styles = new DiagramStyles(root, document, true);

      // Add two custom stylesheets
      const customNodeStyle1 = Stylesheet.fromSnapshot(
        'node',
        {
          id: 'custom-node-1',
          name: 'Custom Node 1',
          props: {}
        },
        styles.crdt.factory
      );
      const customNodeStyle2 = Stylesheet.fromSnapshot(
        'node',
        {
          id: 'custom-node-2',
          name: 'Custom Node 2',
          props: {}
        },
        styles.crdt.factory
      );
      styles.addStylesheet('custom-node-1', customNodeStyle1);
      styles.addStylesheet('custom-node-2', customNodeStyle2);

      // Verify custom-node-2 is active
      expect(styles.activeNodeStylesheet.id).toBe('custom-node-2');

      // Delete custom-node-2
      styles.deleteStylesheet('custom-node-2', UnitOfWork.immediate(document.diagrams[0]!));

      // Verify active stylesheet is updated
      expect(styles.activeNodeStylesheet.id).not.toBe('custom-node-2');
    });
  });

  describe('setStylesheet', () => {
    it('should set a stylesheet on a diagram element', () => {
      const diagram = TestModel.newDiagram();
      const layer = diagram.newLayer('default');
      const element = layer.addNode();

      const styles = new DiagramStyles(root, diagram.document, true);

      // Get the default node stylesheet ID
      const defaultNodeStyleId = styles.nodeStyles[0]!.id;

      // Set a stylesheet on the element
      styles.setStylesheet(
        element as any,
        defaultNodeStyleId,
        UnitOfWork.immediate(document.diagrams[0]!),
        true
      );

      expect(element.metadata.style).toBe(defaultNodeStyleId);
    });

    it('should set a text stylesheet on a node element', () => {
      const diagram = TestModel.newDiagram();
      const layer = diagram.newLayer('default');
      const element = layer.addNode();

      const styles = new DiagramStyles(root, diagram.document, true);

      // Get the default text stylesheet ID
      const defaultTextStyleId = styles.textStyles[0]!.id;

      // Set a text stylesheet on the element
      styles.setStylesheet(
        element as any,
        defaultTextStyleId,
        UnitOfWork.immediate(document.diagrams[0]!),
        true
      );

      expect(element.metadata.textStyle).toBe(defaultTextStyleId);
    });

    it('should update the active stylesheet based on the type', () => {
      const diagram = TestModel.newDiagram();
      const layer = diagram.newLayer('default');
      const element = layer.addNode();

      const styles = new DiagramStyles(root, diagram.document, true);

      // Get the default node stylesheet ID
      const defaultNodeStyleId = styles.nodeStyles[0]!.id;

      // Add a custom node stylesheet
      const customNodeStyle = Stylesheet.fromSnapshot(
        'node',
        {
          id: 'custom-node',
          name: 'Custom Node',
          props: {}
        },
        styles.crdt.factory
      );
      styles.addStylesheet('custom-node', customNodeStyle);

      // Set the default node stylesheet on the element
      styles.setStylesheet(
        element as any,
        defaultNodeStyleId,
        UnitOfWork.immediate(document.diagrams[0]!),
        true
      );

      // Verify the active node stylesheet was updated
      expect(styles.activeNodeStylesheet.id).toBe(defaultNodeStyleId);
    });
  });
});
