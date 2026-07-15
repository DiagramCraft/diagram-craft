import type {
  SerializedDiagram,
  SerializedDiagramDocument
} from '@diagram-craft/model/serialization/serializedTypes';
import type { SerializedComment } from '@diagram-craft/model/comment';

export type DiagramCommentCounts = {
  commentCount: number;
  unresolvedCommentCount: number;
};

const countCommentsInDiagram = (diagram: SerializedDiagram): DiagramCommentCounts => {
  const comments = diagram.comments ?? [];
  const ownCounts = comments.reduce<DiagramCommentCounts>(
    (acc, comment: SerializedComment) => ({
      commentCount: acc.commentCount + (comment.parentId === undefined ? 1 : 0),
      unresolvedCommentCount:
        acc.unresolvedCommentCount +
        (comment.parentId === undefined && comment.state === 'unresolved' ? 1 : 0)
    }),
    { commentCount: 0, unresolvedCommentCount: 0 }
  );

  return diagram.diagrams.reduce((acc, childDiagram) => {
    const childCounts = countCommentsInDiagram(childDiagram);
    return {
      commentCount: acc.commentCount + childCounts.commentCount,
      unresolvedCommentCount: acc.unresolvedCommentCount + childCounts.unresolvedCommentCount
    };
  }, ownCounts);
};

export const getDiagramCommentCounts = (
  document: SerializedDiagramDocument
): DiagramCommentCounts => {
  return document.diagrams.reduce(
    (acc, diagram) => {
      const diagramCounts = countCommentsInDiagram(diagram);
      return {
        commentCount: acc.commentCount + diagramCounts.commentCount,
        unresolvedCommentCount: acc.unresolvedCommentCount + diagramCounts.unresolvedCommentCount
      };
    },
    { commentCount: 0, unresolvedCommentCount: 0 }
  );
};
