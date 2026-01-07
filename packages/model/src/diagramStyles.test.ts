import { beforeEach, describe, expect, it } from 'vitest';
import { DiagramStyles, getCommonProps, Stylesheet } from './diagramStyles';
import { UnitOfWork } from './unitOfWork';
import { DiagramDocument } from './diagramDocument';
import { TestModel } from './test-support/testModel';
import { NoOpCRDTFactory } from '@diagram-craft/collaboration/noopCrdt';
import type { CRDTRoot } from '@diagram-craft/collaboration/crdt';
import { Backends } from '@diagram-craft/collaboration/test-support/collaborationTestUtils';
import type { NodeProps } from './diagramProps';
import { standardTestModel } from '@diagram-craft/model/test-support/collaborationModelTestUtils';

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
      const { diagram1, doc1, doc2 } = standardTestModel(backend);

      const styles1 = doc1.styles;
      const styles2 = doc2 ? doc2.styles : undefined;

      const id = '123';
      const initialProps = { fill: { color: 'blue' } };

      const stylesheet = Stylesheet.fromSnapshot(
        'node',
        { id, name: 'Test', props: initialProps },
        styles1.crdt.factory
      );
      UnitOfWork.execute(diagram1, uow => styles1.addStylesheet(id, stylesheet, uow));

      // Act
      const newProps = { fill: { color: 'red' } };
      UnitOfWork.executeWithUndo(diagram1, 'Set props', uow => stylesheet.setProps(newProps, uow));

      // Verify
      expect(stylesheet.props).toEqual(newProps);
      if (styles2) {
        expect(styles2.getNodeStyle(id)!.props!.fill!.color).toEqual('red');
      }

      // Act & Verify
      diagram1.undoManager.undo();
      expect(stylesheet.props).toEqual(initialProps);
      if (styles2) {
        expect(styles2.getNodeStyle(id)!.props!.fill!.color).toEqual('blue');
      }

      // Act & Verify
      diagram1.undoManager.redo();
      expect(stylesheet.props).toEqual(newProps);
      if (styles2) {
        expect(styles2.getNodeStyle(id)!.props!.fill!.color).toEqual('red');
      }
    });
  });

  describe('setName', () => {
    it('should set a new name', () => {
      // Setup
      // Setup
      const { diagram1, doc1, doc2 } = standardTestModel(backend);

      const styles1 = doc1.styles;
      const styles2 = doc2 ? doc2.styles : undefined;

      const id = '123';
      const name = 'Old Name';
      const newName = 'New Name';

      const stylesheet = Stylesheet.fromSnapshot(
        'node',
        { id, name: name, props: { fill: { color: 'blue' } } },
        styles1.crdt.factory
      );
      UnitOfWork.execute(diagram1, uow => styles1.addStylesheet(id, stylesheet, uow));

      // Act
      UnitOfWork.executeWithUndo(diagram1, 'Set name', uow => stylesheet.setName(newName, uow));

      expect(stylesheet.name).toBe(newName);
      if (styles2) expect(styles2.getNodeStyle(id)!.name).toBe(newName);

      // Act & Verify
      diagram1.undoManager.undo();
      expect(stylesheet.name).toBe(name);
      if (styles2) expect(styles2.getNodeStyle(id)!.name).toBe(name);

      // Act & Verify
      diagram1.undoManager.redo();
      expect(stylesheet.name).toBe(newName);
      if (styles2) expect(styles2.getNodeStyle(id)!.name).toBe(newName);
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
    it('should set, but not sync active stylesheet', () => {
      const { diagram1, doc1, doc2 } = standardTestModel(backend);

      const styles1 = doc1.styles;
      const styles2 = doc2 ? doc2.styles : undefined;

      if (styles2) {
        const id = 'custom';
        const customNodeStyle = Stylesheet.fromSnapshot(
          'node',
          {
            id,
            name: 'Custom',
            props: {}
          },
          styles1.crdt.factory
        );
        UnitOfWork.execute(diagram1, uow => styles1.addStylesheet('custom', customNodeStyle, uow));

        styles1.activeNodeStylesheet = customNodeStyle;

        expect(styles1.activeNodeStylesheet.id).toBe(id);
        expect(styles2.activeNodeStylesheet.id).not.toBe(id);
      }
    });
  });

  describe('activeEdgeStylesheet', () => {
    it('should set, but not sync active stylesheet', () => {
      const { diagram1, doc1, doc2 } = standardTestModel(backend);

      const styles1 = doc1.styles;
      const styles2 = doc2 ? doc2.styles : undefined;

      if (styles2) {
        const id = 'custom';
        const customNodeStyle = Stylesheet.fromSnapshot(
          'edge',
          {
            id,
            name: 'Custom',
            props: {}
          },
          styles1.crdt.factory
        );
        UnitOfWork.execute(diagram1, uow => styles1.addStylesheet('custom', customNodeStyle, uow));

        styles1.activeEdgeStylesheet = customNodeStyle;

        expect(styles1.activeEdgeStylesheet.id).toBe(id);
        expect(styles2.activeEdgeStylesheet.id).not.toBe(id);
      }
    });
  });

  describe('activeTextStylesheet', () => {
    it('should set, but not sync active stylesheet', () => {
      const { diagram1, doc1, doc2 } = standardTestModel(backend);

      const styles1 = doc1.styles;
      const styles2 = doc2 ? doc2.styles : undefined;

      if (styles2) {
        const id = 'custom';
        const customNodeStyle = Stylesheet.fromSnapshot(
          'text',
          {
            id,
            name: 'Custom',
            props: {}
          },
          styles1.crdt.factory
        );
        UnitOfWork.execute(diagram1, uow => styles1.addStylesheet('custom', customNodeStyle, uow));

        styles1.activeTextStylesheet = customNodeStyle;

        expect(styles1.activeTextStylesheet.id).toBe(id);
        expect(styles2.activeTextStylesheet.id).not.toBe(id);
      }
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
      const id = 'custom-node';
      const name = 'Custom Node';

      // Setup
      const { diagram1, doc1, doc2 } = standardTestModel(backend);

      const styles1 = doc1.styles;
      const styles2 = doc2 ? doc2.styles : undefined;

      // Act
      const customNodeStyle = Stylesheet.fromSnapshot(
        'node',
        {
          id,
          name: name,
          props: {}
        },
        styles1.crdt.factory
      );
      UnitOfWork.executeWithUndo(diagram1, 'add', uow =>
        styles1.addStylesheet(id, customNodeStyle, uow)
      );

      // Verify
      const retrievedStyle = styles1.getNodeStyle(id);
      expect(retrievedStyle).toBeDefined();
      expect(retrievedStyle?.id).toBe(id);
      expect(retrievedStyle?.name).toBe(name);
      expect(retrievedStyle?.type).toBe('node');
      if (styles2) {
        const retrievedStyle2 = styles2.getNodeStyle(id);
        expect(retrievedStyle2).toBeDefined();
        expect(retrievedStyle2?.id).toBe(id);
        expect(retrievedStyle2?.name).toBe(name);
        expect(retrievedStyle2?.type).toBe('node');
      }

      // Act & Verify
      diagram1.undoManager.undo();
      expect(styles1.getNodeStyle(id)).toBeUndefined();
      if (styles2) {
        expect(styles2.getNodeStyle(id)).toBeUndefined();
      }

      // Act & Verify
      diagram1.undoManager.redo();
      expect(styles1.getNodeStyle(id)).toBeDefined();
      if (styles2) {
        expect(styles2.getNodeStyle(id)).toBeDefined();
      }
    });

    it('should add a new edge stylesheet', () => {
      const { diagram1, doc1 } = standardTestModel(backend);

      const styles1 = doc1.styles;

      const customEdgeStyle = Stylesheet.fromSnapshot(
        'edge',
        {
          id: 'custom-edge',
          name: 'Custom Edge',
          props: {}
        },
        styles1.crdt.factory
      );
      UnitOfWork.execute(diagram1, uow =>
        styles1.addStylesheet('custom-edge', customEdgeStyle, uow)
      );

      const retrievedStyle = styles1.getEdgeStyle('custom-edge');
      expect(retrievedStyle).toBeDefined();
      expect(retrievedStyle?.id).toBe('custom-edge');
      expect(retrievedStyle?.name).toBe('Custom Edge');
      expect(retrievedStyle?.type).toBe('edge');
    });

    it('should add a new text stylesheet', () => {
      const { diagram1, doc1 } = standardTestModel(backend);

      const styles1 = doc1.styles;

      const customTextStyle = Stylesheet.fromSnapshot(
        'text',
        {
          id: 'custom-text',
          name: 'Custom Text',
          props: {}
        },
        styles1.crdt.factory
      );
      UnitOfWork.execute(diagram1, uow =>
        styles1.addStylesheet('custom-text', customTextStyle, uow)
      );

      const retrievedStyle = styles1.getTextStyle('custom-text');
      expect(retrievedStyle).toBeDefined();
      expect(retrievedStyle?.id).toBe('custom-text');
      expect(retrievedStyle?.name).toBe('Custom Text');
      expect(retrievedStyle?.type).toBe('text');
    });

    it('should set the active stylesheet when adding a new stylesheet', () => {
      const id = 'custom-node';
      const name = 'Custom Node';

      const { diagram1, doc1 } = standardTestModel(backend);

      const styles1 = doc1.styles;

      const customNodeStyle = Stylesheet.fromSnapshot(
        'node',
        {
          id: id,
          name: name,
          props: {}
        },
        styles1.crdt.factory
      );
      UnitOfWork.execute(diagram1, uow => styles1.addStylesheet(id, customNodeStyle, uow));

      expect(styles1.activeNodeStylesheet.id).toBe(id);
    });
  });

  describe('deleteStylesheet', () => {
    it('should delete a custom stylesheet', () => {
      // Setup
      const { diagram1, doc1, doc2 } = standardTestModel(backend);

      const styles1 = doc1.styles;
      const styles2 = doc2 ? doc2.styles : undefined;

      const id = 'custom-node';
      const customNodeStyle = Stylesheet.fromSnapshot(
        'node',
        {
          id: id,
          name: 'Custom Node',
          props: {}
        },
        styles1.crdt.factory
      );
      UnitOfWork.execute(diagram1, uow => styles1.addStylesheet(id, customNodeStyle, uow));

      // Act
      UnitOfWork.executeWithUndo(diagram1, 'delete', uow => styles1.deleteStylesheet(id, uow));

      // Verify
      expect(styles1.getNodeStyle(id)).toBeUndefined();
      if (styles2) {
        expect(styles2.getNodeStyle(id)).toBeUndefined();
      }

      // Act & Verify
      diagram1.undoManager.undo();
      expect(styles1.getNodeStyle(id)).toBeDefined();
      if (styles2) {
        expect(styles2.getNodeStyle(id)).toBeDefined();
      }

      // Act & Verify
      diagram1.undoManager.redo();
      expect(styles1.getNodeStyle(id)).toBeUndefined();
      if (styles2) {
        expect(styles2.getNodeStyle(id)).toBeUndefined();
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
      const { diagram1, doc1 } = standardTestModel(backend);

      const styles1 = doc1.styles;

      // Add two custom stylesheets
      const customNodeStyle1 = Stylesheet.fromSnapshot(
        'node',
        {
          id: 'custom-node-1',
          name: 'Custom Node 1',
          props: {}
        },
        styles1.crdt.factory
      );
      const customNodeStyle2 = Stylesheet.fromSnapshot(
        'node',
        {
          id: 'custom-node-2',
          name: 'Custom Node 2',
          props: {}
        },
        styles1.crdt.factory
      );
      UnitOfWork.execute(diagram1, uow => {
        styles1.addStylesheet('custom-node-1', customNodeStyle1, uow);
        styles1.addStylesheet('custom-node-2', customNodeStyle2, uow);
      });

      // Verify custom-node-2 is active
      expect(styles1.activeNodeStylesheet.id).toBe('custom-node-2');

      // Delete custom-node-2
      UnitOfWork.execute(diagram1, uow => styles1.deleteStylesheet('custom-node-2', uow));

      // Verify active stylesheet is updated
      expect(styles1.activeNodeStylesheet.id).not.toBe('custom-node-2');
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
      UnitOfWork.execute(diagram, uow => styles.addStylesheet('custom-node', customNodeStyle, uow));

      // Set the default node stylesheet on the element
      UnitOfWork.execute(diagram, uow =>
        styles.setStylesheet(element as any, defaultNodeStyleId, uow, true)
      );

      // Verify the active node stylesheet was updated
      expect(styles.activeNodeStylesheet.id).toBe(defaultNodeStyleId);
    });
  });

  describe('events', () => {
    it('should emit stylesheetAdded event when a node stylesheet is added remotely', () => {
      const { diagram1, doc1, doc2 } = standardTestModel(backend);

      if (!doc2) return;

      const styles1 = doc1.styles;
      const styles2 = doc2.styles;

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
      UnitOfWork.execute(diagram1, uow =>
        styles1.addStylesheet('remote-node', customNodeStyle, uow)
      );

      expect(addedStylesheets).toHaveLength(1);
      expect(addedStylesheets[0]!.id).toBe('remote-node');
      expect(addedStylesheets[0]!.name).toBe('Remote Node');
      expect(addedStylesheets[0]!.type).toBe('node');
    });

    it('should emit stylesheetAdded event when an edge stylesheet is added remotely', () => {
      const { diagram1, doc1, doc2 } = standardTestModel(backend);

      if (!doc2) return;

      const styles1 = doc1.styles;
      const styles2 = doc2.styles;

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
      UnitOfWork.execute(diagram1, uow =>
        styles1.addStylesheet('remote-edge', customEdgeStyle, uow)
      );

      expect(addedStylesheets).toHaveLength(1);
      expect(addedStylesheets[0]!.id).toBe('remote-edge');
      expect(addedStylesheets[0]!.name).toBe('Remote Edge');
      expect(addedStylesheets[0]!.type).toBe('edge');
    });

    it('should emit stylesheetAdded event when a text stylesheet is added remotely', () => {
      const { diagram1, doc1, doc2 } = standardTestModel(backend);

      if (!doc2) return;

      const styles1 = doc1.styles;
      const styles2 = doc2.styles;

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
      UnitOfWork.execute(diagram1, uow =>
        styles1.addStylesheet('remote-text', customTextStyle, uow)
      );

      expect(addedStylesheets).toHaveLength(1);
      expect(addedStylesheets[0]!.id).toBe('remote-text');
      expect(addedStylesheets[0]!.name).toBe('Remote Text');
      expect(addedStylesheets[0]!.type).toBe('text');
    });

    it('should emit stylesheetUpdated event when a stylesheet is updated remotely', () => {
      const { diagram1, doc1, doc2 } = standardTestModel(backend);

      if (!doc2) return;

      const styles1 = doc1.styles;
      const styles2 = doc2.styles;

      const customNodeStyle = Stylesheet.fromSnapshot(
        'node',
        {
          id: 'update-test',
          name: 'Update Test',
          props: { fill: { color: 'blue' } }
        },
        styles1.crdt.factory
      );
      UnitOfWork.execute(diagram1, uow =>
        styles1.addStylesheet('update-test', customNodeStyle, uow)
      );

      const updatedStylesheets: Array<Stylesheet<any>> = [];
      styles2.on('stylesheetUpdated', ({ stylesheet }) => {
        updatedStylesheets.push(stylesheet);
      });

      UnitOfWork.execute(TestModel.newDiagram(), uow =>
        customNodeStyle.setProps({ fill: { color: 'red' } }, uow)
      );

      expect(updatedStylesheets).toHaveLength(1);
      expect(updatedStylesheets[0]!.id).toBe('update-test');
      expect(updatedStylesheets[0]!.props.fill?.color).toBe('red');
    });

    it('should emit stylesheetUpdated event when a stylesheet name is updated remotely', () => {
      const { diagram1, doc1, doc2 } = standardTestModel(backend);

      if (!doc2) return;

      const styles1 = doc1.styles;
      const styles2 = doc2.styles;

      const customNodeStyle = Stylesheet.fromSnapshot(
        'node',
        {
          id: 'name-test',
          name: 'Old Name',
          props: {}
        },
        styles1.crdt.factory
      );
      UnitOfWork.execute(diagram1, uow => styles1.addStylesheet('name-test', customNodeStyle, uow));

      const updatedStylesheets: Array<Stylesheet<any>> = [];
      styles2.on('stylesheetUpdated', ({ stylesheet }) => {
        updatedStylesheets.push(stylesheet);
      });

      UnitOfWork.execute(TestModel.newDiagram(), uow => customNodeStyle.setName('New Name', uow));

      expect(updatedStylesheets).toHaveLength(1);
      expect(updatedStylesheets[0]!.id).toBe('name-test');
      expect(updatedStylesheets[0]!.name).toBe('New Name');
    });

    it('should emit stylesheetRemoved event when a stylesheet is deleted remotely', () => {
      const { diagram1, doc1, doc2 } = standardTestModel(backend);

      if (!doc2) return;

      const styles1 = doc1.styles;
      const styles2 = doc2.styles;

      const customNodeStyle = Stylesheet.fromSnapshot(
        'node',
        {
          id: 'delete-test',
          name: 'Delete Test',
          props: {}
        },
        styles1.crdt.factory
      );
      UnitOfWork.execute(diagram1, uow =>
        styles1.addStylesheet('delete-test', customNodeStyle, uow)
      );

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
      const { diagram1, doc1 } = standardTestModel(backend);
      const styles = doc1.styles;

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
      UnitOfWork.execute(diagram1, uow => styles.addStylesheet('local-node', customNodeStyle, uow));

      expect(addedStylesheets).toHaveLength(1);
      expect(addedStylesheets[0]!.id).toBe('local-node');
    });

    it('should emit stylesheetUpdated event for local updates', () => {
      const { diagram1, doc1 } = standardTestModel(backend);
      const styles = doc1.styles;

      const customNodeStyle = Stylesheet.fromSnapshot(
        'node',
        {
          id: 'local-update',
          name: 'Local Update',
          props: { fill: { color: 'blue' } }
        },
        styles.crdt.factory
      );
      UnitOfWork.execute(diagram1, uow =>
        styles.addStylesheet('local-update', customNodeStyle, uow)
      );

      const updatedStylesheets: Array<Stylesheet<any>> = [];
      styles.on('stylesheetUpdated', ({ stylesheet }) => {
        updatedStylesheets.push(stylesheet);
      });

      UnitOfWork.execute(diagram1, uow =>
        customNodeStyle.setProps({ fill: { color: 'red' } }, uow)
      );

      expect(updatedStylesheets).toHaveLength(1);
      expect(updatedStylesheets[0]!.id).toBe('local-update');
      expect(updatedStylesheets[0]!.props.fill?.color).toBe('red');
    });

    it('should emit stylesheetUpdated event for local name changes', () => {
      const { diagram1, doc1 } = standardTestModel(backend);
      const styles = doc1.styles;

      const customNodeStyle = Stylesheet.fromSnapshot(
        'node',
        {
          id: 'local-name',
          name: 'Old Name',
          props: {}
        },
        styles.crdt.factory
      );
      UnitOfWork.execute(diagram1, uow => styles.addStylesheet('local-name', customNodeStyle, uow));

      const updatedStylesheets: Array<Stylesheet<any>> = [];
      styles.on('stylesheetUpdated', ({ stylesheet }) => {
        updatedStylesheets.push(stylesheet);
      });

      UnitOfWork.execute(diagram1, uow => customNodeStyle.setName('New Name', uow));

      expect(updatedStylesheets).toHaveLength(1);
      expect(updatedStylesheets[0]!.id).toBe('local-name');
      expect(updatedStylesheets[0]!.name).toBe('New Name');
    });

    it('should emit stylesheetRemoved event for local deletions', () => {
      const { diagram1, doc1 } = standardTestModel(backend);
      const styles = doc1.styles;

      const customNodeStyle = Stylesheet.fromSnapshot(
        'node',
        {
          id: 'local-delete',
          name: 'Local Delete',
          props: {}
        },
        styles.crdt.factory
      );
      UnitOfWork.execute(diagram1, uow =>
        styles.addStylesheet('local-delete', customNodeStyle, uow)
      );

      const removedStylesheets: Array<string> = [];
      styles.on('stylesheetRemoved', ({ stylesheet }) => {
        removedStylesheets.push(stylesheet);
      });

      UnitOfWork.execute(diagram1, uow => styles.deleteStylesheet('local-delete', uow));

      expect(removedStylesheets).toHaveLength(1);
      expect(removedStylesheets[0]!).toBe('local-delete');
    });

    it('should emit multiple events when multiple remote changes occur', () => {
      const { diagram1, doc1, doc2 } = standardTestModel(backend);

      if (!doc2) return;

      const styles1 = doc1.styles;
      const styles2 = doc2.styles;

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
      UnitOfWork.execute(diagram1, uow => styles1.addStylesheet('multi-1', style1, uow));

      const style2 = Stylesheet.fromSnapshot(
        'edge',
        { id: 'multi-2', name: 'Multi 2', props: {} },
        styles1.crdt.factory
      );
      UnitOfWork.execute(diagram1, uow => styles1.addStylesheet('multi-2', style2, uow));

      UnitOfWork.execute(TestModel.newDiagram(), uow => {
        style1.setName('Updated Multi 1', uow);
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
