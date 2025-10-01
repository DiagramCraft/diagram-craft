import { describe, expect, it } from 'vitest';
import { TestDiagramBuilder, TestModel } from '../test-support/builder';
import { serializeDiagramDocument, serializeDiagramElement } from './serialize';
import { deserializeDiagramDocument } from './deserialize';
import { UnitOfWork } from '../unitOfWork';
import type { RegularLayer } from '../diagramLayerRegular';
import { Comment } from '../comment';
import { DefaultDataProvider } from '../dataProviderDefault';

describe('serialization', () => {
  describe('serializeDiagramElement', () => {
    describe('tags', () => {
      it('should serialize node with tags', () => {
        // Setup
        const diagram = TestModel.newDiagram();
        const node = diagram.newLayer().addNode();
        const tags = ['tag1', 'tag2', 'important'];
        node.setTags(tags, UnitOfWork.immediate(diagram));

        // Act
        const serialized = serializeDiagramElement(node);

        // Verify
        expect(serialized.tags).toEqual(tags);
      });

      it('should serialize edge with tags', () => {
        // Setup
        const diagram = TestModel.newDiagram();
        const edge = diagram.newLayer().addEdge();
        const tags = ['connection', 'flow', 'critical'];
        edge.setTags(tags, UnitOfWork.immediate(diagram));

        // Act
        const serialized = serializeDiagramElement(edge);

        // Verify
        expect(serialized.tags).toEqual(tags);
      });

      it('should not serialize tags property when element has no tags', () => {
        // Setup
        const layer = TestModel.newDiagram().newLayer();
        const node = layer.addNode();

        // Act
        const serialized = serializeDiagramElement(node);

        // Verify
        expect(serialized.tags).toBeUndefined();
      });

      it('should serialize empty tags as undefined', () => {
        // Setup
        const diagram = TestModel.newDiagram();
        const node = diagram.newLayer().addNode();
        node.setTags([], UnitOfWork.immediate(diagram));

        // Act
        const serialized = serializeDiagramElement(node);

        // Verify
        expect(serialized.tags).toBeUndefined();
      });
    });
  });

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
  });
});
