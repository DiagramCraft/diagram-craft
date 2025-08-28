import { describe, expect, it, beforeEach, vi } from 'vitest';
import { Comment, CommentManager } from './comment';
import { TestModel } from './test-support/builder';
import { DiagramNode } from './diagramNode';
import { Backends, standardTestModel } from './collaboration/collaborationTestUtils';

describe.each(Backends.all())('Comment [%s]', (_name, backend) => {
  beforeEach(() => {
    backend.beforeEach();
  });

  describe('Comment', () => {
    it('should resolve comment', () => {
      const { doc1 } = standardTestModel(backend);
      const comment = new Comment(doc1.diagrams[0], 'diagram', '1', 'Test', 'Author', new Date());

      expect(comment.state).toBe('unresolved');
      comment.resolve();
      expect(comment.state).toBe('resolved');
    });

    it('should unresolve comment', () => {
      const { doc1 } = standardTestModel(backend);
      const comment = new Comment(doc1.diagrams[0], 'diagram', '1', 'Test', 'Author', new Date());
      comment.resolve();

      expect(comment.state).toBe('resolved');
      comment.unresolve();
      expect(comment.state).toBe('unresolved');
    });

    it('should identify if comment is a reply', () => {
      const { doc1 } = standardTestModel(backend);
      const comment = new Comment(doc1.diagrams[0], 'diagram', '1', 'Root', 'Author', new Date());
      const replyComment = new Comment(
        doc1.diagrams[0],
        'diagram',
        '2',
        'Reply',
        'Author',
        new Date(),
        'unresolved',
        undefined,
        '1'
      );

      expect(comment.isReply()).toBe(false);
      expect(replyComment.isReply()).toBe(true);
    });

    it('should serialize element comment correctly', () => {
      const { diagram, layer } = TestModel.newDiagramWithLayer({
        root: backend.syncedDocs()[0],
        nodes: [{ id: 'node-1', bounds: { x: 10, y: 10, w: 50, h: 50, r: 0 } }]
      });
      const element = layer.elements[0] as DiagramNode;
      const date = new Date('2023-01-01T10:00:00Z');
      const comment = new Comment(
        diagram,
        'element',
        'comment-1',
        'Element comment',
        'Jane Doe',
        date,
        'unresolved',
        element
      );

      const serialized = comment.serialize();

      expect(serialized.type).toBe('element');
      expect(serialized.elementId).toBe(element.id);
      expect(serialized.diagramId).toBe(diagram.id);
    });

    it('should deserialize element comment correctly', () => {
      const { diagram, layer } = TestModel.newDiagramWithLayer({
        root: backend.syncedDocs()[0],
        nodes: [{ id: 'node-1', bounds: { x: 10, y: 10, w: 50, h: 50, r: 0 } }]
      });
      const element = layer.elements[0] as DiagramNode;
      const serialized = {
        id: 'comment-1',
        date: '2023-01-01T10:00:00.000Z',
        author: 'Jane Doe',
        message: 'Element comment',
        state: 'unresolved' as const,
        type: 'element' as const,
        diagramId: diagram.id,
        elementId: element.id
      };

      const comment = Comment.deserialize(serialized, diagram.document);

      expect(comment).not.toBeNull();
      expect(comment!.type).toBe('element');
      expect(comment!.element).toBe(element);
      expect(comment!.diagram).toBe(diagram);
    });
  });

  describe('CommentManager', () => {
    let commentManager: CommentManager;
    let commentManager2: CommentManager | undefined;
    let doc: any;
    let diagram: any;

    beforeEach(() => {
      const { doc1, doc2 } = standardTestModel(backend);
      doc = doc1;
      diagram = doc.diagrams[0];

      commentManager = doc.commentManager;
      commentManager2 = doc2 ? doc2.commentManager : undefined;
    });

    it('should add and retrieve comment', () => {
      // Setup
      const comment = new Comment(diagram, 'diagram', '1', 'Test comment', 'Author', new Date());

      // Act
      commentManager.addComment(comment);
      const retrieved = commentManager.getComment('1');

      // Verify
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe('1');
      expect(retrieved!.message).toBe('Test comment');

      if (commentManager2) {
        const retrieved2 = commentManager2.getComment('1');
        expect(retrieved2).not.toBeNull();
        expect(retrieved2!.id).toBe('1');
        expect(retrieved2!.message).toBe('Test comment');
      }
    });

    it('should emit commentAdded event when adding comment', () => {
      // Setup
      const eventSpy = vi.fn();
      commentManager.on('commentAdded', eventSpy);
      const comment = new Comment(diagram, 'diagram', '1', 'Test comment', 'Author', new Date());

      // Act
      commentManager.addComment(comment);

      // Verify
      expect(eventSpy).toHaveBeenCalledTimes(1);
      expect(eventSpy).toHaveBeenCalledWith({ comment });
    });

    it('should return undefined for non-existent comment', () => {
      const retrieved = commentManager.getComment('non-existent');
      expect(retrieved).toBeUndefined();
    });

    it('should get all comments', () => {
      const comment1 = new Comment(diagram, 'diagram', 'comment-1', 'First', 'Author', new Date());
      const comment2 = new Comment(diagram, 'diagram', 'comment-2', 'Second', 'Author', new Date());

      commentManager.addComment(comment1);
      commentManager.addComment(comment2);

      const allComments = commentManager.getAllComments();
      expect(allComments).toHaveLength(2);
      expect(allComments.map(c => c.id)).toContain('comment-1');
      expect(allComments.map(c => c.id)).toContain('comment-2');
    });

    it('should get comments for specific diagram', () => {
      const comment = new Comment(diagram, 'diagram', '1', 'Diagram comment', 'Author', new Date());

      commentManager.addComment(comment);
      const diagramComments = commentManager.getCommentsForDiagram(diagram);

      expect(diagramComments).toHaveLength(1);
      expect(diagramComments[0].id).toBe('1');
    });

    it('should update existing comment', () => {
      const comment = new Comment(diagram, 'diagram', '1', 'Msg', 'Author', new Date());

      commentManager.addComment(comment);
      comment.resolve();
      commentManager.updateComment(comment);

      const retrieved = commentManager.getComment('1');
      expect(retrieved!.state).toBe('resolved');

      if (commentManager2) {
        const retrieved2 = commentManager2.getComment('1');
        expect(retrieved2!.state).toBe('resolved');
      }
    });

    it('should emit commentUpdated event when updating comment', () => {
      // Setup
      const eventSpy = vi.fn();
      commentManager.on('commentUpdated', eventSpy);
      const comment = new Comment(diagram, 'diagram', '1', 'Msg', 'Author', new Date());
      commentManager.addComment(comment);

      // Act
      comment.resolve();
      commentManager.updateComment(comment);

      // Verify
      expect(eventSpy).toHaveBeenCalledTimes(1);
      expect(eventSpy).toHaveBeenCalledWith({ comment });
    });

    it('should remove comment', () => {
      const comment = new Comment(diagram, 'diagram', '1', 'Test comment', 'Author', new Date());

      commentManager.addComment(comment);
      expect(commentManager.getComment('1')).not.toBeUndefined();

      commentManager.removeComment('1');
      expect(commentManager.getComment('1')).toBeUndefined();

      if (commentManager2) {
        expect(commentManager2.getComment('1')).toBeUndefined();
      }
    });

    it('should emit commentRemoved event when removing comment', () => {
      // Setup
      const eventSpy = vi.fn();
      commentManager.on('commentRemoved', eventSpy);
      const comment = new Comment(diagram, 'diagram', '1', 'Test comment', 'Author', new Date());
      commentManager.addComment(comment);

      // Act
      commentManager.removeComment('1');

      // Verify
      expect(eventSpy).toHaveBeenCalledTimes(1);
      expect(eventSpy).toHaveBeenCalledWith({ commentId: '1' });
    });

    it('should add reply to comment', () => {
      const rootComment = new Comment(diagram, 'diagram', '1', 'Root', 'Author', new Date());
      const replyComment = new Comment(
        diagram,
        'diagram',
        '2',
        'Reply',
        'Author',
        new Date(),
        'unresolved',
        undefined,
        '1'
      );

      commentManager.addComment(rootComment);
      commentManager.replyToComment(rootComment, replyComment);

      const retrieved = commentManager.getComment('2');
      expect(retrieved).not.toBeNull();
      expect(retrieved!.parentId).toBe('1');

      if (commentManager2) {
        const retrieved2 = commentManager2.getComment('2');
        expect(retrieved2).not.toBeNull();
        expect(retrieved2!.parentId).toBe('1');
      }
    });

    it('should get replies to comment', () => {
      const rootComment = new Comment(
        diagram,
        'diagram',
        '1',
        'Root comment',
        'Author',
        new Date()
      );
      const reply1 = new Comment(
        diagram,
        'diagram',
        '1',
        'First reply',
        'Author',
        new Date(),
        'unresolved',
        undefined,
        '1'
      );
      const reply2 = new Comment(
        diagram,
        'diagram',
        '2',
        'Second reply',
        'Author',
        new Date(),
        'unresolved',
        undefined,
        '1'
      );

      commentManager.addComment(rootComment);
      commentManager.addComment(reply1);
      commentManager.addComment(reply2);

      const replies = commentManager.getReplies(rootComment);
      expect(replies).toHaveLength(2);
      expect(replies.map(r => r.id)).toContain('1');
      expect(replies.map(r => r.id)).toContain('2');
    });

    it('should get complete comment thread', () => {
      const rootComment = new Comment(
        diagram,
        'diagram',
        'root',
        'Root comment',
        'Author',
        new Date()
      );
      const reply1 = new Comment(
        diagram,
        'diagram',
        'reply-1',
        'First reply',
        'Author',
        new Date(),
        'unresolved',
        undefined,
        'root'
      );
      const nestedReply = new Comment(
        diagram,
        'diagram',
        'nested',
        'Nested reply',
        'Author',
        new Date(),
        'unresolved',
        undefined,
        'reply-1'
      );

      commentManager.addComment(rootComment);
      commentManager.addComment(reply1);
      commentManager.addComment(nestedReply);

      const thread = commentManager.getCommentThread(nestedReply);
      expect(thread).toHaveLength(3);
      expect(thread[0].id).toBe('root');
      expect(thread[1].id).toBe('reply-1');
      expect(thread[2].id).toBe('nested');
    });
  });
});
