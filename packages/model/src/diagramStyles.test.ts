import { beforeEach, describe, expect, it } from 'vitest';
import { DiagramStyles, getCommonProps, Stylesheet } from './diagramStyles';
import { StylesheetSnapshot, UnitOfWork } from './unitOfWork';
import { DiagramDocument } from './diagramDocument';
import { TestModel } from './test-support/testModel';
import { NoOpCRDTFactory } from '@diagram-craft/collaboration/noopCrdt';
import type { CRDTRoot } from '@diagram-craft/collaboration/crdt';
import { Backends } from '@diagram-craft/collaboration/test-support/collaborationTestUtils';
import type { NodeProps } from './diagramProps';

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
      UnitOfWork.execute(TestModel.newDiagram(), uow =>
        stylesheet.setProps(newProps, styles1, uow)
      );

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
      UnitOfWork.execute(TestModel.newDiagram(), uow => stylesheet.setName(newName, styles1, uow));

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

      UnitOfWork.execute(TestModel.newDiagram(), uow => stylesheet.restore(snapshot, uow));

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
      UnitOfWork.execute(TestModel.newDiagram(), uow =>
        styles1.deleteStylesheet('custom-node', uow)
      );

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
      UnitOfWork.execute(TestModel.newDiagram(), uow =>
        styles.deleteStylesheet(defaultNodeStyleId, uow)
      );

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
      UnitOfWork.execute(TestModel.newDiagram(), uow =>
        styles.deleteStylesheet('custom-node-2', uow)
      );

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
      UnitOfWork.execute(TestModel.newDiagram(), uow =>
        styles.setStylesheet(element as any, defaultNodeStyleId, uow, true)
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
      UnitOfWork.execute(TestModel.newDiagram(), uow =>
        styles.setStylesheet(element as any, defaultTextStyleId, uow, true)
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
      UnitOfWork.execute(TestModel.newDiagram(), uow =>
        styles.setStylesheet(element as any, defaultNodeStyleId, uow, true)
      );

      // Verify the active node stylesheet was updated
      expect(styles.activeNodeStylesheet.id).toBe(defaultNodeStyleId);
    });
  });

  describe('events', () => {
    it('should emit stylesheetAdded event when a node stylesheet is added remotely', () => {
      const [root1, root2] = backend.syncedDocs();
      if (!root2) return;

      const styles1 = new DiagramStyles(root1, TestModel.newDocument(), true);
      const styles2 = new DiagramStyles(root2, TestModel.newDocument(), true);

      const addedStylesheets: Array<Stylesheet<any>> = [];
      styles2.on('stylesheetAdded', ({ stylesheet }) => {
        addedStylesheets.push(stylesheet);
      });

      const customNodeStyle = Stylesheet.fromSnapshot(
        'node',
        {
          id: 'remote-node',
          name: 'Remote Node',
          props: { fill: { color: 'blue' } }
        },
        styles1.crdt.factory
      );
      styles1.addStylesheet('remote-node', customNodeStyle);

      expect(addedStylesheets).toHaveLength(1);
      expect(addedStylesheets[0]!.id).toBe('remote-node');
      expect(addedStylesheets[0]!.name).toBe('Remote Node');
      expect(addedStylesheets[0]!.type).toBe('node');
    });

    it('should emit stylesheetAdded event when an edge stylesheet is added remotely', () => {
      const [root1, root2] = backend.syncedDocs();
      if (!root2) return;

      const styles1 = new DiagramStyles(root1, TestModel.newDocument(), true);
      const styles2 = new DiagramStyles(root2, TestModel.newDocument(), true);

      const addedStylesheets: Array<Stylesheet<any>> = [];
      styles2.on('stylesheetAdded', ({ stylesheet }) => {
        addedStylesheets.push(stylesheet);
      });

      const customEdgeStyle = Stylesheet.fromSnapshot(
        'edge',
        {
          id: 'remote-edge',
          name: 'Remote Edge',
          props: { stroke: { color: 'red' } }
        },
        styles1.crdt.factory
      );
      styles1.addStylesheet('remote-edge', customEdgeStyle);

      expect(addedStylesheets).toHaveLength(1);
      expect(addedStylesheets[0]!.id).toBe('remote-edge');
      expect(addedStylesheets[0]!.name).toBe('Remote Edge');
      expect(addedStylesheets[0]!.type).toBe('edge');
    });

    it('should emit stylesheetAdded event when a text stylesheet is added remotely', () => {
      const [root1, root2] = backend.syncedDocs();
      if (!root2) return;

      const styles1 = new DiagramStyles(root1, TestModel.newDocument(), true);
      const styles2 = new DiagramStyles(root2, TestModel.newDocument(), true);

      const addedStylesheets: Array<Stylesheet<any>> = [];
      styles2.on('stylesheetAdded', ({ stylesheet }) => {
        addedStylesheets.push(stylesheet);
      });

      const customTextStyle = Stylesheet.fromSnapshot(
        'text',
        {
          id: 'remote-text',
          name: 'Remote Text',
          props: { text: { fontSize: 16 } }
        },
        styles1.crdt.factory
      );
      styles1.addStylesheet('remote-text', customTextStyle);

      expect(addedStylesheets).toHaveLength(1);
      expect(addedStylesheets[0]!.id).toBe('remote-text');
      expect(addedStylesheets[0]!.name).toBe('Remote Text');
      expect(addedStylesheets[0]!.type).toBe('text');
    });

    it('should emit stylesheetUpdated event when a stylesheet is updated remotely', () => {
      const [root1, root2] = backend.syncedDocs();
      if (!root2) return;

      const styles1 = new DiagramStyles(root1, TestModel.newDocument(), true);
      const styles2 = new DiagramStyles(root2, TestModel.newDocument(), true);

      const customNodeStyle = Stylesheet.fromSnapshot(
        'node',
        {
          id: 'update-test',
          name: 'Update Test',
          props: { fill: { color: 'blue' } }
        },
        styles1.crdt.factory
      );
      styles1.addStylesheet('update-test', customNodeStyle);

      const updatedStylesheets: Array<Stylesheet<any>> = [];
      styles2.on('stylesheetUpdated', ({ stylesheet }) => {
        updatedStylesheets.push(stylesheet);
      });

      UnitOfWork.execute(TestModel.newDiagram(), uow =>
        customNodeStyle.setProps({ fill: { color: 'red' } }, styles1, uow)
      );

      expect(updatedStylesheets).toHaveLength(1);
      expect(updatedStylesheets[0]!.id).toBe('update-test');
      expect(updatedStylesheets[0]!.props.fill?.color).toBe('red');
    });

    it('should emit stylesheetUpdated event when a stylesheet name is updated remotely', () => {
      const [root1, root2] = backend.syncedDocs();
      if (!root2) return;

      const styles1 = new DiagramStyles(root1, TestModel.newDocument(), true);
      const styles2 = new DiagramStyles(root2, TestModel.newDocument(), true);

      const customNodeStyle = Stylesheet.fromSnapshot(
        'node',
        {
          id: 'name-test',
          name: 'Old Name',
          props: {}
        },
        styles1.crdt.factory
      );
      styles1.addStylesheet('name-test', customNodeStyle);

      const updatedStylesheets: Array<Stylesheet<any>> = [];
      styles2.on('stylesheetUpdated', ({ stylesheet }) => {
        updatedStylesheets.push(stylesheet);
      });

      UnitOfWork.execute(TestModel.newDiagram(), uow =>
        customNodeStyle.setName('New Name', styles1, uow)
      );

      expect(updatedStylesheets).toHaveLength(1);
      expect(updatedStylesheets[0]!.id).toBe('name-test');
      expect(updatedStylesheets[0]!.name).toBe('New Name');
    });

    it('should emit stylesheetRemoved event when a stylesheet is deleted remotely', () => {
      const [root1, root2] = backend.syncedDocs();
      if (!root2) return;

      const styles1 = new DiagramStyles(root1, TestModel.newDocument(), true);
      const styles2 = new DiagramStyles(root2, TestModel.newDocument(), true);

      const customNodeStyle = Stylesheet.fromSnapshot(
        'node',
        {
          id: 'delete-test',
          name: 'Delete Test',
          props: {}
        },
        styles1.crdt.factory
      );
      styles1.addStylesheet('delete-test', customNodeStyle);

      const removedStylesheets: Array<string> = [];
      styles2.on('stylesheetRemoved', ({ stylesheet }) => {
        removedStylesheets.push(stylesheet);
      });

      UnitOfWork.execute(TestModel.newDiagram(), uow =>
        styles1.deleteStylesheet('delete-test', uow)
      );

      expect(removedStylesheets).toHaveLength(1);
      expect(removedStylesheets[0]!).toBe('delete-test');
    });

    it('should emit stylesheetAdded event for local additions', () => {
      const styles = new DiagramStyles(root, document, true);

      const addedStylesheets: Array<Stylesheet<any>> = [];
      styles.on('stylesheetAdded', ({ stylesheet }) => {
        addedStylesheets.push(stylesheet);
      });

      const customNodeStyle = Stylesheet.fromSnapshot(
        'node',
        {
          id: 'local-node',
          name: 'Local Node',
          props: {}
        },
        styles.crdt.factory
      );
      styles.addStylesheet('local-node', customNodeStyle);

      expect(addedStylesheets).toHaveLength(1);
      expect(addedStylesheets[0]!.id).toBe('local-node');
    });

    it('should emit stylesheetUpdated event for local updates', () => {
      const styles = new DiagramStyles(root, document, true);

      const customNodeStyle = Stylesheet.fromSnapshot(
        'node',
        {
          id: 'local-update',
          name: 'Local Update',
          props: { fill: { color: 'blue' } }
        },
        styles.crdt.factory
      );
      styles.addStylesheet('local-update', customNodeStyle);

      const updatedStylesheets: Array<Stylesheet<any>> = [];
      styles.on('stylesheetUpdated', ({ stylesheet }) => {
        updatedStylesheets.push(stylesheet);
      });

      UnitOfWork.execute(TestModel.newDiagram(), uow =>
        customNodeStyle.setProps({ fill: { color: 'red' } }, styles, uow)
      );

      expect(updatedStylesheets).toHaveLength(1);
      expect(updatedStylesheets[0]!.id).toBe('local-update');
      expect(updatedStylesheets[0]!.props.fill?.color).toBe('red');
    });

    it('should emit stylesheetUpdated event for local name changes', () => {
      const styles = new DiagramStyles(root, document, true);

      const customNodeStyle = Stylesheet.fromSnapshot(
        'node',
        {
          id: 'local-name',
          name: 'Old Name',
          props: {}
        },
        styles.crdt.factory
      );
      styles.addStylesheet('local-name', customNodeStyle);

      const updatedStylesheets: Array<Stylesheet<any>> = [];
      styles.on('stylesheetUpdated', ({ stylesheet }) => {
        updatedStylesheets.push(stylesheet);
      });

      UnitOfWork.execute(TestModel.newDiagram(), uow =>
        customNodeStyle.setName('New Name', styles, uow)
      );

      expect(updatedStylesheets).toHaveLength(1);
      expect(updatedStylesheets[0]!.id).toBe('local-name');
      expect(updatedStylesheets[0]!.name).toBe('New Name');
    });

    it('should emit stylesheetRemoved event for local deletions', () => {
      const styles = new DiagramStyles(root, document, true);

      const customNodeStyle = Stylesheet.fromSnapshot(
        'node',
        {
          id: 'local-delete',
          name: 'Local Delete',
          props: {}
        },
        styles.crdt.factory
      );
      styles.addStylesheet('local-delete', customNodeStyle);

      const removedStylesheets: Array<string> = [];
      styles.on('stylesheetRemoved', ({ stylesheet }) => {
        removedStylesheets.push(stylesheet);
      });

      UnitOfWork.execute(TestModel.newDiagram(), uow =>
        styles.deleteStylesheet('local-delete', uow)
      );

      expect(removedStylesheets).toHaveLength(1);
      expect(removedStylesheets[0]!).toBe('local-delete');
    });

    it('should emit multiple events when multiple remote changes occur', () => {
      const [root1, root2] = backend.syncedDocs();
      if (!root2) return;

      const styles1 = new DiagramStyles(root1, TestModel.newDocument(), true);
      const styles2 = new DiagramStyles(root2, TestModel.newDocument(), true);

      const events: Array<{ type: string; id: string }> = [];
      styles2.on('stylesheetAdded', ({ stylesheet }) => {
        events.push({ type: 'added', id: stylesheet.id });
      });
      styles2.on('stylesheetUpdated', ({ stylesheet }) => {
        events.push({ type: 'updated', id: stylesheet.id });
      });
      styles2.on('stylesheetRemoved', ({ stylesheet }) => {
        events.push({ type: 'removed', id: stylesheet });
      });

      const style1 = Stylesheet.fromSnapshot(
        'node',
        { id: 'multi-1', name: 'Multi 1', props: {} },
        styles1.crdt.factory
      );
      styles1.addStylesheet('multi-1', style1);

      const style2 = Stylesheet.fromSnapshot(
        'edge',
        { id: 'multi-2', name: 'Multi 2', props: {} },
        styles1.crdt.factory
      );
      styles1.addStylesheet('multi-2', style2);

      UnitOfWork.execute(TestModel.newDiagram(), uow => {
        style1.setName('Updated Multi 1', styles1, uow);
        styles1.deleteStylesheet('multi-2', uow);
      });

      expect(events).toHaveLength(4);
      expect(events).toEqual([
        { type: 'added', id: 'multi-1' },
        { type: 'added', id: 'multi-2' },
        { type: 'updated', id: 'multi-1' },
        { type: 'removed', id: 'multi-2' }
      ]);
    });
  });
});
