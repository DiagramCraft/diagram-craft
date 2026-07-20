import { describe, expect, test, vi } from 'vitest';
import type { Comment } from '@diagram-craft/model/comment';
import type { Diagram } from '@diagram-craft/model/diagram';
import { getCommentMarkers, getVisibleRootComments } from './CommentPinsComponent';

const makeComment = (overrides: Partial<Comment> = {}) =>
  ({
    id: 'comment',
    date: new Date('2026-01-01T00:00:00Z'),
    state: 'unresolved',
    type: 'diagram',
    isReply: () => false,
    isStale: () => false,
    ...overrides
  }) as unknown as Comment;

const makeDiagram = (comments: Comment[]) =>
  ({
    bounds: { x: 0, y: 0, w: 500, h: 400, r: 0 },
    commentManager: { getAll: vi.fn(() => comments) },
    layers: { visible: [{ id: 'layer-1' }] }
  }) as unknown as Diagram;

describe('comment canvas markers', () => {
  test('filters root comments by visibility mode', () => {
    const unresolved = makeComment({ state: 'unresolved' });
    const resolved = makeComment({ state: 'resolved' });
    const reply = makeComment({ parentId: 'root', isReply: () => true });

    expect(getVisibleRootComments([unresolved, resolved, reply], 'all')).toEqual([
      unresolved,
      resolved
    ]);
    expect(getVisibleRootComments([unresolved, resolved, reply], 'unresolved')).toEqual([
      unresolved
    ]);
    expect(getVisibleRootComments([unresolved, resolved, reply], 'none')).toEqual([]);
  });

  test('aggregates element and diagram roots and chooses the newest visible root', () => {
    const element = {
      id: 'element-1',
      bounds: { x: 100, y: 80, w: 120, h: 60, r: 0 },
      layer: { id: 'layer-1' },
      isHidden: () => false
    } as unknown as Comment['element'];
    const olderElementComment = makeComment({
      id: 'older-element-comment',
      type: 'element',
      element,
      date: new Date('2026-01-01T00:00:00Z')
    });
    const newerElementComment = makeComment({
      id: 'newer-element-comment',
      type: 'element',
      element,
      state: 'resolved',
      date: new Date('2026-01-02T00:00:00Z')
    });
    const diagramComment = makeComment({ id: 'diagram-comment', type: 'diagram' });

    const markers = getCommentMarkers(
      makeDiagram([olderElementComment, newerElementComment, diagramComment]),
      'all'
    );

    expect(markers).toHaveLength(2);
    expect(markers.find(marker => marker.comments.length === 2)).toMatchObject({
      comment: newerElementComment,
      position: { x: 220, y: 80 },
      draggable: false
    });
    expect(markers.find(marker => marker.comment === diagramComment)).toMatchObject({
      position: { x: 500, y: 0 },
      draggable: false
    });
  });

  test('does not create markers in none mode', () => {
    const comment = makeComment();
    expect(getCommentMarkers(makeDiagram([comment]), 'none')).toEqual([]);
  });
});
