import { describe, test, expect, beforeEach } from 'vitest';
import { Comment } from '@diagram-craft/model/comment';
import { TestModel } from '@diagram-craft/model/test-support/testModel';
import { newid } from '@diagram-craft/utils/id';
import {
  buildCommentThreads,
  groupThreadsByAuthor,
  groupThreadsByElement,
  getElementNameFromComment,
  type CommentThread
} from './utils';

describe('CommentsToolWindow utils', () => {
  let diagramBuilder: any;
  let element: any;

  beforeEach(() => {
    const { diagram, layer } = TestModel.newDiagramWithLayer({
      nodes: [{ id: 'test-element' }]
    });
    diagramBuilder = diagram;
    element = layer.elements.find((e: any) => e.id === 'test-element');
  });

  describe('getElementNameFromComment', () => {
    test('returns "Diagram" for diagram comments', () => {
      const comment = new Comment(
        diagramBuilder,
        'diagram',
        newid(),
        'Test comment',
        'John Doe',
        new Date()
      );

      expect(getElementNameFromComment(comment)).toBe('Diagram');
    });

    test('returns element name for element comments', () => {
      const comment = new Comment(
        diagramBuilder,
        'element',
        newid(),
        'Test comment',
        'John Doe',
        new Date(),
        'unresolved',
        element
      );

      expect(getElementNameFromComment(comment)).toBe(element?.name || 'Unknown Element');
    });

    test('returns "Unknown Element" for element comments without element', () => {
      const comment = new Comment(
        diagramBuilder,
        'element',
        newid(),
        'Test comment',
        'John Doe',
        new Date()
      );

      expect(getElementNameFromComment(comment)).toBe('Unknown Element');
    });
  });

  describe('buildCommentThreads', () => {
    test('builds simple thread with no replies', () => {
      const comment = new Comment(
        diagramBuilder,
        'diagram',
        'comment-1',
        'Root comment',
        'John Doe',
        new Date()
      );

      const threads = buildCommentThreads([comment]);

      expect(threads).toHaveLength(1);
      expect(threads[0]!.root).toBe(comment);
      expect(threads[0]!.replies).toHaveLength(0);
    });

    test('builds thread with replies', () => {
      const rootComment = new Comment(
        diagramBuilder,
        'diagram',
        'root',
        'Root comment',
        'John Doe',
        new Date()
      );

      const reply1 = new Comment(
        diagramBuilder,
        'diagram',
        'reply1',
        'First reply',
        'Jane Doe',
        new Date(),
        'unresolved',
        undefined,
        'root'
      );

      const reply2 = new Comment(
        diagramBuilder,
        'diagram',
        'reply2',
        'Second reply',
        'Bob Smith',
        new Date(),
        'unresolved',
        undefined,
        'reply1'
      );

      const threads = buildCommentThreads([rootComment, reply1, reply2]);

      expect(threads).toHaveLength(1);
      expect(threads[0]!.root).toBe(rootComment);
      expect(threads[0]!.replies).toHaveLength(1);
      expect(threads[0]!.replies[0]!.comment).toBe(reply1);
      expect(threads[0]!.replies[0]!.level).toBe(1);
      expect(threads[0]!.replies[0]!.replies).toHaveLength(1);
      expect(threads[0]!.replies[0]!.replies[0]!.comment).toBe(reply2);
      expect(threads[0]!.replies[0]!.replies[0]!.level).toBe(2);
    });

    test('filters out replies from root level', () => {
      const rootComment = new Comment(
        diagramBuilder,
        'diagram',
        'root',
        'Root comment',
        'John Doe',
        new Date()
      );

      const reply = new Comment(
        diagramBuilder,
        'diagram',
        'reply',
        'Reply',
        'Jane Doe',
        new Date(),
        'unresolved',
        undefined,
        'root'
      );

      const threads = buildCommentThreads([rootComment, reply]);

      expect(threads).toHaveLength(1);
      expect(threads[0]!.root).toBe(rootComment);
    });

    test('limits nesting depth to 3 levels', () => {
      const comments = [];
      let parentId: string | undefined = undefined;

      // Create 5 levels of nesting
      for (let i = 0; i < 5; i++) {
        const comment: Comment = new Comment(
          diagramBuilder,
          'diagram',
          `comment-${i}`,
          `Comment ${i}`,
          'Author',
          new Date(),
          'unresolved',
          undefined,
          parentId
        );
        comments.push(comment);
        parentId = comment.id;
      }

      const threads = buildCommentThreads(comments);

      expect(threads).toHaveLength(1);

      // Check that we only go 3 levels deep (root + 3 reply levels)
      let currentNode = threads[0]!;
      let depth = 0;

      while (currentNode.replies.length > 0) {
        depth++;
        currentNode = { replies: currentNode.replies[0]!.replies } as any;
        if (depth >= 3) break;
      }

      expect(depth).toBe(3);
    });
  });

  describe('groupThreadsByElement', () => {
    test('groups threads by element name', () => {
      const diagramComment = new Comment(
        diagramBuilder,
        'diagram',
        'diagram-comment',
        'Diagram comment',
        'John Doe',
        new Date()
      );

      const elementComment = new Comment(
        diagramBuilder,
        'element',
        'element-comment',
        'Element comment',
        'Jane Doe',
        new Date(),
        'unresolved',
        element
      );

      const threads: CommentThread[] = [
        { root: diagramComment, replies: [] },
        { root: elementComment, replies: [] }
      ];

      const groups = groupThreadsByElement(threads);

      expect(groups.length).toBeGreaterThanOrEqual(2);

      // Find groups by checking the threads they contain
      const diagramGroup = groups.find(g => g.threads.some(t => t.root.type === 'diagram'));
      const elementGroup = groups.find(g => g.threads.some(t => t.root.type === 'element'));

      expect(diagramGroup).toBeDefined();
      expect(diagramGroup!.threads).toHaveLength(1);
      expect(diagramGroup!.threads[0]!.root).toBe(diagramComment);

      expect(elementGroup).toBeDefined();
      expect(elementGroup!.threads).toHaveLength(1);
      expect(elementGroup!.threads[0]!.root).toBe(elementComment);
    });
  });

  describe('groupThreadsByAuthor', () => {
    test('groups threads by author name', () => {
      const comment1 = new Comment(
        diagramBuilder,
        'diagram',
        'comment-1',
        'Comment 1',
        'John Doe',
        new Date()
      );

      const comment2 = new Comment(
        diagramBuilder,
        'diagram',
        'comment-2',
        'Comment 2',
        'Jane Doe',
        new Date()
      );

      const comment3 = new Comment(
        diagramBuilder,
        'diagram',
        'comment-3',
        'Comment 3',
        'John Doe',
        new Date()
      );

      const threads: CommentThread[] = [
        { root: comment1, replies: [] },
        { root: comment2, replies: [] },
        { root: comment3, replies: [] }
      ];

      const groups = groupThreadsByAuthor(threads);

      expect(groups).toHaveLength(2);

      const johnGroup = groups.find(g => g.key === 'John Doe');
      const janeGroup = groups.find(g => g.key === 'Jane Doe');

      expect(johnGroup).toBeDefined();
      expect(johnGroup!.threads).toHaveLength(2);
      expect(johnGroup!.title).toBe('John Doe');

      expect(janeGroup).toBeDefined();
      expect(janeGroup!.threads).toHaveLength(1);
      expect(janeGroup!.title).toBe('Jane Doe');
    });
  });
});
