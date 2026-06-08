import { describe, expect, it } from 'vitest';
import type {
  SerializedDiagram,
  SerializedDiagramDocument
} from '@diagram-craft/model/serialization/serializedTypes';
import type { SerializedComment } from '@diagram-craft/model/comment';
import { getDiagramCommentCounts } from './commentCounts';

const makeComment = (id: string, state: 'resolved' | 'unresolved'): SerializedComment => ({
  id,
  type: 'diagram',
  message: id,
  author: 'user',
  date: new Date('2025-01-01').toISOString(),
  state,
  diagramId: 'diagram'
});

const makeDiagram = (
  id: string,
  comments: SerializedComment[] = [],
  diagrams: SerializedDiagram[] = []
): SerializedDiagram => ({
  id,
  name: id,
  layers: [],
  diagrams,
  canvas: { x: 0, y: 0, w: 100, h: 100 },
  comments
});

const makeDocument = (diagrams: SerializedDiagram[]): SerializedDiagramDocument => ({
  diagrams,
  customPalette: [],
  styles: { edgeStyles: [], nodeStyles: [], textStyles: [] },
  schemas: []
});

describe('getDiagramCommentCounts', () => {
  it('returns zero counts when there are no comments', () => {
    expect(getDiagramCommentCounts(makeDocument([makeDiagram('root')]))).toEqual({
      commentCount: 0,
      unresolvedCommentCount: 0
    });
  });

  it('counts root comments and unresolved root comments', () => {
    const result = getDiagramCommentCounts(
      makeDocument([
        makeDiagram('root', [makeComment('a', 'unresolved'), makeComment('b', 'resolved')])
      ])
    );

    expect(result).toEqual({ commentCount: 2, unresolvedCommentCount: 1 });
  });

  it('excludes replies because counts are tracked per thread', () => {
    const reply = { ...makeComment('reply', 'unresolved'), parentId: 'root-comment' };
    const root = makeComment('root-comment', 'unresolved');

    expect(getDiagramCommentCounts(makeDocument([makeDiagram('root', [root, reply])]))).toEqual({
      commentCount: 1,
      unresolvedCommentCount: 1
    });
  });

  it('counts comments recursively in nested diagrams', () => {
    const child = makeDiagram('child', [
      makeComment('c1', 'resolved'),
      makeComment('c2', 'unresolved')
    ]);
    const root = makeDiagram('root', [makeComment('r1', 'unresolved')], [child]);

    expect(getDiagramCommentCounts(makeDocument([root]))).toEqual({
      commentCount: 3,
      unresolvedCommentCount: 2
    });
  });
});
