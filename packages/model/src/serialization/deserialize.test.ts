import { describe, expect, it } from 'vitest';
import { TestDiagramBuilder, TestModel } from '../test-support/testModel';
import { serializeDiagramDocument } from './serialize';
import { deserializeDiagramDocument } from './deserialize';
import { UnitOfWork } from '../unitOfWork';
import type { RegularLayer } from '../diagramLayerRegular';
import { Comment } from '../comment';
import { DefaultDataProvider } from '../data-providers/dataProviderDefault';
import { DelegatingDiagramNode } from '../delegatingDiagramNode';
import { ModificationLayer } from '../diagramLayerModification';
import { AnchorEndpoint } from '../endpoint';
import { DelegatingDiagramEdge } from '../delegatingDiagramEdge';
import type { Diagram } from '../diagram';

const createModificationLayer = (diagram: TestDiagramBuilder) => {
  const modLayer = new ModificationLayer('mod-layer', 'Modifications', diagram, []);
  diagram.layers.add(modLayer, UnitOfWork.immediate(diagram));
  return modLayer;
};

const getModificationLayer = (diagram: Diagram) => {
  const modLayer = diagram.layers.all.find(l => l.type === 'modification') as ModificationLayer;
  expect(modLayer).toBeDefined();
  return modLayer!;
};

describe('deserializeDiagramDocument', () => {
  describe('tags', () => {
    it('should round-trip tags correctly for nodes and edges', async () => {
      // Setup
      const originalDoc = TestModel.newDocument();
      const diagram = new TestDiagramBuilder(originalDoc);
      const layer = diagram.newLayer();

      const node = layer.addNode({ id: 'node-1' });
      const nodeTags = ['ui', 'component', 'button'];
      node.setTags(nodeTags, UnitOfWork.immediate(diagram));

      const edge = layer.addEdge({ id: 'edge-1' });
      const edgeTags = ['flow', 'data', 'critical'];
      edge.setTags(edgeTags, UnitOfWork.immediate(diagram));

      originalDoc.addDiagram(diagram);

      // Act
      const serialized = await serializeDiagramDocument(originalDoc);

      const newDoc = TestModel.newDocument();
      await deserializeDiagramDocument(
        serialized,
        newDoc,
        (d, doc) => new TestDiagramBuilder(doc, d.id)
      );

      // Verify
      const newDiagram = newDoc.diagrams[0]!;
      const newLayer = newDiagram.layers.all[0] as RegularLayer;
      const elements = newLayer.elements;

      const deserializedNode = elements.find(el => el.id === 'node-1');
      const deserializedEdge = elements.find(el => el.id === 'edge-1');

      expect(deserializedNode?.tags).toEqual(nodeTags);
      expect(deserializedEdge?.tags).toEqual(edgeTags);
    });

    it('should populate document tags from all element tags', async () => {
      // Setup
      const originalDoc = TestModel.newDocument();

      const diagram1 = new TestDiagramBuilder(originalDoc, 'diagram1');
      const layer1 = diagram1.newLayer();
      const node1 = layer1.addNode();
      node1.setTags(['ui', 'button', 'primary'], UnitOfWork.immediate(diagram1));

      const edge1 = layer1.addEdge();
      edge1.setTags(['flow', 'data'], UnitOfWork.immediate(diagram1));

      const diagram2 = new TestDiagramBuilder(originalDoc, 'diagram2');
      const layer2 = diagram2.newLayer();
      const node2 = layer2.addNode();
      node2.setTags(['api', 'service', 'primary'], UnitOfWork.immediate(diagram2)); // 'primary' overlaps

      const edge2 = layer2.addEdge();
      edge2.setTags(['network', 'http'], UnitOfWork.immediate(diagram2));

      originalDoc.addDiagram(diagram1);
      originalDoc.addDiagram(diagram2);

      // Act
      const serialized = await serializeDiagramDocument(originalDoc);

      const newDoc = TestModel.newDocument();
      await deserializeDiagramDocument(
        serialized,
        newDoc,
        (d, doc) => new TestDiagramBuilder(doc, d.id)
      );

      // Verify
      const expectedTags = [
        'api',
        'button',
        'data',
        'flow',
        'http',
        'network',
        'primary',
        'service',
        'ui'
      ];
      expect([...newDoc.tags.tags].sort()).toEqual(expectedTags);
    });

    it('should handle documents with no tags', async () => {
      // Setup
      const originalDoc = TestModel.newDocument();
      const diagram = new TestDiagramBuilder(originalDoc);
      const layer = diagram.newLayer();

      layer.addNode();
      layer.addEdge();
      originalDoc.addDiagram(diagram);

      // Act
      const serialized = await serializeDiagramDocument(originalDoc);

      const newDoc = TestModel.newDocument();
      await deserializeDiagramDocument(
        serialized,
        newDoc,
        (d, doc) => new TestDiagramBuilder(doc, d.id)
      );

      // Verify
      expect(newDoc.tags.tags).toEqual([]);

      const newDiagram = newDoc.diagrams[0]!;
      const newLayer = newDiagram.layers.all[0] as RegularLayer;
      const elements = newLayer.elements;

      elements.forEach(element => {
        expect(element.tags).toEqual([]);
      });
    });

    it('should handle nested diagrams with tags', async () => {
      // Setup
      const originalDoc = TestModel.newDocument();

      const parentDiagram = new TestDiagramBuilder(originalDoc, 'parent');
      const parentLayer = parentDiagram.newLayer();
      const parentNode = parentLayer.addNode();
      parentNode.setTags(['parent', 'container'], UnitOfWork.immediate(parentDiagram));

      const childDiagram = new TestDiagramBuilder(originalDoc, 'child');
      const childLayer = childDiagram.newLayer();
      const childNode = childLayer.addNode();
      childNode.setTags(['child', 'detail'], UnitOfWork.immediate(childDiagram));

      originalDoc.addDiagram(parentDiagram);
      originalDoc.addDiagram(childDiagram, parentDiagram);

      // Act
      const serialized = await serializeDiagramDocument(originalDoc);

      const newDoc = TestModel.newDocument();
      await deserializeDiagramDocument(
        serialized,
        newDoc,
        (d, doc) => new TestDiagramBuilder(doc, d.id)
      );

      // Verify
      const expectedTags = ['child', 'container', 'detail', 'parent'];
      expect([...newDoc.tags.tags].sort()).toEqual(expectedTags);
    });
  });

  describe('comments', () => {
    it('should serialize and deserialize comments correctly', async () => {
      // Setup
      const originalDoc = TestModel.newDocument();
      const diagram = new TestDiagramBuilder(originalDoc);
      const layer = diagram.newLayer();
      const node = layer.addNode();

      // Add diagram comment
      const diagramComment = new Comment(
        diagram,
        'diagram',
        'comment-1',
        'This is a diagram comment',
        'author1',
        new Date('2024-01-01T10:00:00Z')
      );
      diagram.commentManager.addComment(diagramComment);

      // Add element comment
      const elementComment = new Comment(
        diagram,
        'element',
        'comment-2',
        'This is an element comment',
        'author2',
        new Date('2024-01-01T11:00:00Z'),
        'unresolved',
        node
      );
      diagram.commentManager.addComment(elementComment);

      // Add reply comment
      const replyComment = new Comment(
        diagram,
        'element',
        'comment-3',
        'This is a reply',
        'author3',
        new Date('2024-01-01T12:00:00Z'),
        'resolved',
        node,
        'comment-2'
      );
      diagram.commentManager.addComment(replyComment);

      originalDoc.addDiagram(diagram);

      // Act
      const serialized = await serializeDiagramDocument(originalDoc);

      const newDoc = TestModel.newDocument();
      await deserializeDiagramDocument(
        serialized,
        newDoc,
        (d, doc) => new TestDiagramBuilder(doc, d.id)
      );

      // Verify
      const allComments = newDoc.diagrams[0]!.commentManager.getAll();
      expect(allComments).toHaveLength(3);

      const diagramComments = newDoc.diagrams[0]!.commentManager.getDiagramComments();
      expect(diagramComments).toHaveLength(1);
      expect(diagramComments[0]!.message).toBe('This is a diagram comment');
      expect(diagramComments[0]!.author).toBe('author1');
    });

    it('should handle documents with no comments', async () => {
      // Setup
      const originalDoc = TestModel.newDocument();
      const diagram = new TestDiagramBuilder(originalDoc);
      diagram.newLayer().addNode();
      originalDoc.addDiagram(diagram);

      // Act
      const serialized = await serializeDiagramDocument(originalDoc);

      const newDoc = TestModel.newDocument();
      await deserializeDiagramDocument(
        serialized,
        newDoc,
        (d, doc) => new TestDiagramBuilder(doc, d.id)
      );

      // Verify
      expect(newDoc.diagrams[0]!.commentManager.getAll()).toHaveLength(0);
    });
  });

  describe('schema metadata', () => {
    it('should serialize and deserialize schema metadata', async () => {
      // Setup
      const originalDoc = TestModel.newDocument();
      const diagram = new TestDiagramBuilder(originalDoc);
      diagram.newLayer(); // Add a layer so serialization works
      originalDoc.addDiagram(diagram);

      // Add a schema with metadata
      const schema = {
        id: 'test-schema',
        name: 'Test Schema',
        providerId: 'urlDataProvider',
        fields: []
      };
      originalDoc.data._schemas.add(schema);
      originalDoc.data._schemas.setMetadata('test-schema', {
        availableForElementLocalData: true,
        useDocumentOverrides: true
      });

      // Act
      const serialized = await serializeDiagramDocument(originalDoc);

      const newDoc = TestModel.newDocument();
      await deserializeDiagramDocument(
        serialized,
        newDoc,
        (d, doc) => new TestDiagramBuilder(doc, d.id)
      );

      // Verify
      const metadata = newDoc.data._schemas.getMetadata('test-schema');
      expect(metadata.availableForElementLocalData).toBe(true);
      expect(metadata.useDocumentOverrides).toBe(true);
    });

    it('should handle backwards compatibility for old documents without metadata', async () => {
      // Setup - create a serialized document with old format (no schemaMetadata field)
      const originalDoc = TestModel.newDocument();
      const diagram = new TestDiagramBuilder(originalDoc);
      diagram.newLayer(); // Add a layer so serialization works
      originalDoc.addDiagram(diagram);

      const schema = {
        id: 'old-schema',
        name: 'Old Schema',
        providerId: 'urlDataProvider',
        fields: []
      };
      originalDoc.data._schemas.add(schema);

      const serialized = await serializeDiagramDocument(originalDoc);

      // Modify serialized to old format (remove schemaMetadata)
      const oldFormatSerialized = {
        ...serialized
      };
      delete oldFormatSerialized.schemaMetadata;

      // Act
      const newDoc = TestModel.newDocument();
      await deserializeDiagramDocument(
        oldFormatSerialized,
        newDoc,
        (d, doc) => new TestDiagramBuilder(doc, d.id)
      );

      // Verify - should use default values
      const metadata = newDoc.data._schemas.getMetadata('old-schema');
      expect(metadata.availableForElementLocalData).toBe(true);
      expect(metadata.useDocumentOverrides).toBe(false);
    });
  });

  describe('overrides', () => {
    it('should serialize and deserialize document overrides', async () => {
      // Setup
      const doc = TestModel.newDocument();
      const schemaId = 'test-schema';

      // Set up provider with schema and some data
      const updateData = { _uid: 'update-uid-2', name: 'Updated Item' };
      const deleteData = { _uid: 'delete-uid-3', name: 'Deleted Item' };
      const provider = new DefaultDataProvider(
        JSON.stringify({
          schemas: [
            {
              id: schemaId,
              name: 'Test Schema',
              providerId: 'default',
              fields: [{ id: 'name', name: 'Name', type: 'text' }]
            }
          ],
          data: [
            { ...updateData, _schemaId: schemaId, name: 'Original Update Item' },
            { ...deleteData, _schemaId: schemaId }
          ]
        })
      );
      doc.data.setProviders([provider]);
      doc.data.setSchemaMetadata(schemaId, { useDocumentOverrides: true });

      // Add some overrides
      const addData = { _uid: 'add-uid-1', name: 'Added Item' };

      await doc.data.db.addData(doc.data.db.getSchema(schemaId), addData);
      await doc.data.db.updateData(doc.data.db.getSchema(schemaId), updateData);
      await doc.data.db.deleteData(doc.data.db.getSchema(schemaId), deleteData);

      // Act - Serialize
      const serialized = await serializeDiagramDocument(doc);

      // Verify serialization
      expect(serialized.data?.overrides).toBeDefined();
      expect(serialized.data?.overrides![schemaId]).toBeDefined();
      expect(serialized.data!.overrides![schemaId]!['add-uid-1']).toEqual({
        type: 'add',
        data: addData
      });
      expect(serialized.data!.overrides![schemaId]!['update-uid-2']).toEqual({
        type: 'update',
        data: updateData
      });
      expect(serialized.data!.overrides![schemaId]!['delete-uid-3']).toEqual({
        type: 'delete',
        data: deleteData
      });

      // Act - Deserialize
      const newDoc = TestModel.newDocument();
      await deserializeDiagramDocument(
        serialized,
        newDoc,
        (d, doc) => new TestDiagramBuilder(doc, d.id)
      );

      // Verify deserialization
      const addResult = newDoc.data.db.getOverrideStatusForItem(schemaId, 'add-uid-1');
      expect(addResult.override).toEqual({
        type: 'add',
        data: addData
      });
      const updateResult = newDoc.data.db.getOverrideStatusForItem(schemaId, 'update-uid-2');
      expect(updateResult.override).toEqual({
        type: 'update',
        data: updateData
      });
      const deleteResult = newDoc.data.db.getOverrideStatusForItem(schemaId, 'delete-uid-3');
      expect(deleteResult.override).toEqual({
        type: 'delete',
        data: deleteData
      });
    });

    it('should handle empty overrides', async () => {
      // Setup
      const doc = TestModel.newDocument();

      // Act
      const serialized = await serializeDiagramDocument(doc);

      // Verify
      expect(serialized.data?.overrides).toEqual({});

      // Deserialize
      const newDoc = TestModel.newDocument();
      await deserializeDiagramDocument(
        serialized,
        newDoc,
        (d, doc) => new TestDiagramBuilder(doc, d.id)
      );

      // Should not throw and should work fine
      expect(newDoc.data.db).toBeDefined();
    });
  });

  describe('modification layers', () => {
    it('should serialize and deserialize modification layer with add, remove, and change modifications', async () => {
      // Setup
      const originalDoc = TestModel.newDocument();
      const diagram = new TestDiagramBuilder(originalDoc);

      // Create a regular layer with base elements
      const regularLayer = diagram.newLayer();
      const baseNodeForAdd = regularLayer.addNode({ id: 'base-node' });
      baseNodeForAdd.setTags(['base', 'original'], UnitOfWork.immediate(diagram));

      const nodeToRemove = regularLayer.addNode({ id: 'node-to-remove' });
      nodeToRemove.setTags(['temp'], UnitOfWork.immediate(diagram));

      const nodeToChange = regularLayer.addNode({ id: 'node-to-change' });
      nodeToChange.setTags(['original'], UnitOfWork.immediate(diagram));

      // Create a modification layer
      const modLayer = createModificationLayer(diagram);

      // Add modification
      const delegatingNode1 = new DelegatingDiagramNode('delegating-1', baseNodeForAdd, modLayer);
      delegatingNode1.setBounds(
        { x: 15, y: 15, h: 25, w: 50, r: 0.5 },
        UnitOfWork.immediate(diagram)
      );
      modLayer.modifyAdd('base-node', delegatingNode1, UnitOfWork.immediate(diagram));

      // Remove modification
      modLayer.modifyRemove('node-to-remove', UnitOfWork.immediate(diagram));

      // Change modification
      const delegatingNode2 = new DelegatingDiagramNode('delegating-2', nodeToChange, modLayer);
      delegatingNode2.setBounds(
        { x: 5, y: 10, w: 15, h: 20, r: 0.25 },
        UnitOfWork.immediate(diagram)
      );
      modLayer.modifyChange('node-to-change', delegatingNode2, UnitOfWork.immediate(diagram));

      originalDoc.addDiagram(diagram);

      // Act
      const serialized = await serializeDiagramDocument(originalDoc);

      const newDoc = TestModel.newDocument();
      await deserializeDiagramDocument(
        serialized,
        newDoc,
        (d, doc) => new TestDiagramBuilder(doc, d.id)
      );

      // Verify
      const newDiagram = newDoc.diagrams[0]!;
      const modificationLayer = getModificationLayer(newDiagram);
      expect(modificationLayer.modifications).toHaveLength(3);

      // Verify add modification
      const addModification = modificationLayer.modifications.find(m => m.id === 'base-node');
      expect(addModification).toBeDefined();
      expect(addModification!.type).toBe('add');
      expect(addModification!.element).toBeDefined();
      expect(addModification!.element!.type).toBe('delegating-node');
      expect(addModification!.element!.bounds).toEqual({ x: 15, y: 15, h: 25, w: 50, r: 0.5 });

      // Verify remove modification
      const removeModification = modificationLayer.modifications.find(
        m => m.id === 'node-to-remove'
      );
      expect(removeModification).toBeDefined();
      expect(removeModification!.type).toBe('remove');
      expect(removeModification!.element).toBeUndefined();

      // Verify change modification
      const changeModification = modificationLayer.modifications.find(
        m => m.id === 'node-to-change'
      );
      expect(changeModification).toBeDefined();
      expect(changeModification!.type).toBe('change');
      expect(changeModification!.element).toBeDefined();
      expect(changeModification!.element!.type).toBe('delegating-node');
      expect(changeModification!.element!.bounds).toEqual({ x: 5, y: 10, w: 15, h: 20, r: 0.25 });
    });

    it('should serialize and deserialize delegating node and edge with all overridable attributes', async () => {
      // Setup
      const originalDoc = TestModel.newDocument();
      const diagram = new TestDiagramBuilder(originalDoc);

      // Create a regular layer with base elements
      const regularLayer = diagram.newLayer();

      // Setup for delegating node
      const baseNode = regularLayer.addNode({ id: 'base-node' });
      baseNode.updateProps(props => {
        props.fill = { color: 'red' };
        props.stroke = { color: 'blue' };
      }, UnitOfWork.immediate(diagram));
      baseNode.setText('Base Text', UnitOfWork.immediate(diagram));
      baseNode.updateMetadata(metadata => {
        metadata.name = 'Base Name';
      }, UnitOfWork.immediate(diagram));

      // Setup for delegating edge
      const node1 = regularLayer.addNode({ id: 'node-1' });
      const node2 = regularLayer.addNode({ id: 'node-2' });
      const baseEdge = regularLayer.addEdge({ id: 'base-edge' });
      baseEdge.updateProps(props => {
        props.stroke = { color: 'red', width: 2 };
        props.arrow = { end: { type: 'BAR', size: 10 } };
      }, UnitOfWork.immediate(diagram));
      baseEdge.updateMetadata(metadata => {
        metadata.name = 'Base Edge';
      }, UnitOfWork.immediate(diagram));

      // Create a modification layer
      const modLayer = createModificationLayer(diagram);

      // Create delegating node with all overrides
      const delegatingNode = new DelegatingDiagramNode('delegating-1', baseNode, modLayer, {
        bounds: { x: 100, y: 200, w: 300, h: 400, r: 0.5 },
        props: {
          fill: { color: 'green' },
          stroke: { color: 'yellow', width: 5 }
        },
        texts: { text: 'Override Text', subtitle: 'Override Subtitle' },
        metadata: {
          name: 'Override Name',
          data: {
            customData: { key1: 'value1' },
            data: [{ schema: 'schema1', type: 'schema', data: {} }]
          }
        }
      });
      modLayer.modifyChange('base-node', delegatingNode, UnitOfWork.immediate(diagram));

      // Create delegating edge with all overrides
      const newStart = new AnchorEndpoint(node1, 'anchor1', { x: 0.2, y: 0.3 });
      const newEnd = new AnchorEndpoint(node2, 'anchor2', { x: 0.8, y: 0.7 });
      const waypoints = [{ point: { x: 100, y: 100 } }, { point: { x: 200, y: 150 } }];

      const delegatingEdge = new DelegatingDiagramEdge('delegating-edge-1', baseEdge, modLayer, {
        props: {
          stroke: { color: 'blue', width: 5 },
          arrow: { start: { type: 'BALL_FILLED', size: 12 }, end: { type: 'BAR_END', size: 8 } }
        },
        start: newStart,
        end: newEnd,
        waypoints: waypoints,
        metadata: {
          name: 'Override Edge',
          data: {
            customData: { edgeKey: 'edgeValue' },
            data: [{ schema: 'edge-schema', type: 'schema', data: {} }]
          }
        }
      });

      modLayer.modifyChange('base-edge', delegatingEdge, UnitOfWork.immediate(diagram));

      originalDoc.addDiagram(diagram);

      // Act
      const serialized = await serializeDiagramDocument(originalDoc);

      const newDoc = TestModel.newDocument();
      await deserializeDiagramDocument(
        serialized,
        newDoc,
        (d, doc) => new TestDiagramBuilder(doc, d.id)
      );

      // Verify
      const newDiagram = newDoc.diagrams[0]!;
      const modificationLayer = getModificationLayer(newDiagram);
      expect(modificationLayer.modifications).toHaveLength(2);

      // Verify delegating node
      const nodeModification = modificationLayer.modifications.find(m => m.id === 'base-node');
      expect(nodeModification).toBeDefined();
      expect(nodeModification!.type).toBe('change');
      expect(nodeModification!.element).toBeDefined();

      const deserializedNode = nodeModification!.element! as DelegatingDiagramNode;

      // Verify node bounds override
      expect(deserializedNode.bounds).toEqual({ x: 100, y: 200, w: 300, h: 400, r: 0.5 });

      // Verify node props override
      expect(deserializedNode.renderProps.fill?.color).toBe('green');
      expect(deserializedNode.renderProps.stroke?.color).toBe('yellow');
      expect(deserializedNode.renderProps.stroke?.width).toBe(5);

      // Verify node texts override
      expect(deserializedNode.getText()).toBe('Override Text');
      expect(deserializedNode.getText('subtitle')).toBe('Override Subtitle');

      // Verify node metadata override
      expect(deserializedNode.metadata.name).toBe('Override Name');
      expect(deserializedNode.metadata.data?.customData?.key1).toBe('value1');
      expect(deserializedNode.metadata.data?.data).toHaveLength(1);
      expect(deserializedNode.metadata.data?.data![0]).toEqual({
        schema: 'schema1',
        type: 'schema'
      });

      // Verify delegating edge
      const edgeModification = modificationLayer.modifications.find(m => m.id === 'base-edge');
      expect(edgeModification).toBeDefined();
      expect(edgeModification!.type).toBe('change');
      expect(edgeModification!.element).toBeDefined();

      const deserializedEdge = edgeModification!.element! as DelegatingDiagramEdge;

      // Verify edge props override
      expect(deserializedEdge.renderProps.stroke?.color).toBe('blue');
      expect(deserializedEdge.renderProps.stroke?.width).toBe(5);
      expect(deserializedEdge.renderProps.arrow?.start).toEqual({ type: 'diamond', size: 12 });
      expect(deserializedEdge.renderProps.arrow?.end).toEqual({ type: 'circle', size: 8 });

      // Verify edge start/end overrides
      expect(deserializedEdge.start).toBeInstanceOf(AnchorEndpoint);
      expect(deserializedEdge.end).toBeInstanceOf(AnchorEndpoint);
      if (deserializedEdge.start instanceof AnchorEndpoint) {
        expect(deserializedEdge.start.node.id).toBe(node1.id);
        expect(deserializedEdge.start.anchorId).toBe('anchor1');
        expect(deserializedEdge.start.offset).toEqual({ x: 0.2, y: 0.3 });
      }
      if (deserializedEdge.end instanceof AnchorEndpoint) {
        expect(deserializedEdge.end.node.id).toBe(node2.id);
        expect(deserializedEdge.end.anchorId).toBe('anchor2');
        expect(deserializedEdge.end.offset).toEqual({ x: 0.8, y: 0.7 });
      }

      // Verify edge waypoints override
      expect(deserializedEdge.waypoints).toHaveLength(2);
      expect(deserializedEdge.waypoints[0]!.point).toEqual({ x: 100, y: 100 });
      expect(deserializedEdge.waypoints[1]!.point).toEqual({ x: 200, y: 150 });

      // Verify edge metadata override
      expect(deserializedEdge.metadata.name).toBe('Override Edge');
      expect(deserializedEdge.metadata.data?.customData?.edgeKey).toBe('edgeValue');
      expect(deserializedEdge.metadata.data?.data).toHaveLength(1);
      expect(deserializedEdge.metadata.data?.data![0]).toEqual({
        schema: 'edge-schema',
        type: 'schema'
      });
    });
  });
});
