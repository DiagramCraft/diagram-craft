import type { CanvasState } from '../canvas/EditableCanvasComponent';
import { Component, onEvent } from '../component/component';
import * as svg from '../component/vdom-svg';
import { Box } from '@diagram-craft/geometry/box';
import type { Point } from '@diagram-craft/geometry/point';
import type { Comment } from '@diagram-craft/model/comment';
import type { Indicator } from '@diagram-craft/model/diagramProps';
import { DeepRequired } from '@diagram-craft/utils/types';
import { INDICATORS } from './indicators';
import { DRAG_DROP_MANAGER } from '../dragDropManager';
import { PointCommentMoveDrag } from '../drag/pointCommentDrag';
import { EventHelper } from '@diagram-craft/utils-dom/eventHelper';
import { CanvasDomHelper } from '../utils/canvasDomHelper';
import type { Diagram } from '@diagram-craft/model/diagram';
import { isCommentVisible, type CommentVisibility } from './commentVisibility';

const PIN_SIZE = 20;
const COMMENT_PIN_BOUNDS: Box = { x: 0, y: 0, w: PIN_SIZE, h: PIN_SIZE, r: 0 };

const COMMENT_PIN_INDICATOR: DeepRequired<Indicator> = {
  enabled: true,
  shape: 'comment',
  color: 'var(--accent-9)',
  height: PIN_SIZE,
  width: PIN_SIZE,
  direction: 'e',
  position: 'c',
  offset: 0
};

const RESOLVED_COMMENT_PIN_INDICATOR: DeepRequired<Indicator> = {
  ...COMMENT_PIN_INDICATOR,
  color: 'var(--base-fg-more-dim)'
};

export type CommentMarker = {
  comment: Comment;
  comments: Comment[];
  position: Point;
  draggable: boolean;
};

export const getVisibleRootComments = (
  comments: Comment[],
  visibility: CommentVisibility | undefined
) => comments.filter(comment => !comment.isReply() && isCommentVisible(visibility, comment.state));

export const getCommentMarkers = (
  diagram: Diagram,
  visibility: CommentVisibility | undefined
): CommentMarker[] => {
  const roots = getVisibleRootComments(diagram.commentManager.getAll(), visibility);
  if (visibility === 'none') return [];

  const markers: CommentMarker[] = [];

  for (const comment of roots) {
    if (comment.type === 'point' && comment.position) {
      markers.push({
        comment,
        comments: [comment],
        position: comment.position,
        draggable: true
      });
    }
  }

  const elementComments = new Map<string, Comment[]>();
  for (const comment of roots) {
    if (
      comment.type !== 'element' ||
      !comment.element ||
      comment.isStale() ||
      comment.element.isHidden() ||
      !diagram.layers.visible.some(layer => layer.id === comment.element!.layer.id)
    ) {
      continue;
    }

    const comments = elementComments.get(comment.element.id) ?? [];
    comments.push(comment);
    elementComments.set(comment.element.id, comments);
  }

  for (const comments of elementComments.values()) {
    const element = comments[0]!.element!;
    markers.push({
      comment: newestComment(comments),
      comments,
      position: {
        x: element.bounds.x + element.bounds.w,
        y: element.bounds.y
      },
      draggable: false
    });
  }

  const diagramComments = roots.filter(comment => comment.type === 'diagram');
  if (diagramComments.length > 0) {
    markers.push({
      comment: newestComment(diagramComments),
      comments: diagramComments,
      position: {
        x: diagram.bounds.x + diagram.bounds.w,
        y: diagram.bounds.y
      },
      draggable: false
    });
  }

  return markers;
};

const newestComment = (comments: Comment[]) =>
  [...comments].sort((a, b) => b.date.getTime() - a.date.getTime())[0]!;

const allCommentsResolved = (comments: Comment[]) =>
  comments.every(comment => comment.state === 'resolved');

export class CommentPinsComponent extends Component<CanvasState> {
  render(props: CanvasState) {
    const diagram = props.diagram;

    onEvent(diagram.viewBox, 'viewbox', () => this.redraw());
    onEvent(diagram.commentManager, 'commentAdded', () => this.redraw());
    onEvent(diagram.commentManager, 'commentUpdated', () => this.redraw());
    onEvent(diagram.commentManager, 'commentRemoved', () => this.redraw());

    return svg.g(
      {},
      ...getCommentMarkers(diagram, props.commentVisibility).map(marker =>
        this.renderMarker(marker, props)
      )
    );
  }

  private renderMarker(marker: CommentMarker, props: CanvasState) {
    const { comment, comments, position, draggable } = marker;
    const isMuted = allCommentsResolved(comments);
    const indicator = isMuted ? RESOLVED_COMMENT_PIN_INDICATOR : COMMENT_PIN_INDICATOR;
    const fillColor = isMuted ? 'var(--cmp-bg)' : 'var(--accent-3)';

    return svg.g(
      {
        transform: `translate(${position.x - PIN_SIZE / 2}, ${position.y - PIN_SIZE})`,
        style: `cursor: ${draggable ? 'grab' : 'pointer'};${isMuted ? ' opacity: 0.5;' : ''}`,
        on: {
          mousedown: e => this.handleMouseDown(e, comment, draggable, props)
        }
      },
      INDICATORS.comment(COMMENT_PIN_BOUNDS, indicator, fillColor)
    );
  }

  private handleMouseDown(e: MouseEvent, comment: Comment, draggable: boolean, props: CanvasState) {
    if (e.button !== 0) return;

    if (!draggable) {
      props.context.actions.COMMENT_EDIT?.execute({ comment });
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    const canvas = CanvasDomHelper.diagramElement(props.diagram);
    if (!canvas) return;

    const initialPointer = props.diagram.viewBox.toDiagramPoint(
      EventHelper.pointWithRespectTo(e, canvas)
    );
    const drag = new PointCommentMoveDrag(props.diagram, comment.id, initialPointer);

    DRAG_DROP_MANAGER.initiate(drag, () => {
      if (!drag.didMove) {
        props.context.actions.COMMENT_EDIT?.execute({
          comment: props.diagram.commentManager.getComment(comment.id) ?? comment
        });
      }
    });

    e.preventDefault();
    e.stopPropagation();
  }
}
