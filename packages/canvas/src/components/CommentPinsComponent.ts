import type { CanvasState } from '../canvas/EditableCanvasComponent';
import { Component, onEvent } from '../component/component';
import * as svg from '../component/vdom-svg';
import { Box } from '@diagram-craft/geometry/box';
import type { Comment } from '@diagram-craft/model/comment';
import type { Indicator } from '@diagram-craft/model/diagramProps';
import { DeepRequired } from '@diagram-craft/utils/types';
import { INDICATORS } from './indicators';

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

export class CommentPinsComponent extends Component<CanvasState> {
  render(props: CanvasState) {
    const diagram = props.diagram;

    onEvent(diagram.viewBox, 'viewbox', () => this.redraw());
    onEvent(diagram.commentManager, 'commentAdded', () => this.redraw());
    onEvent(diagram.commentManager, 'commentUpdated', () => this.redraw());
    onEvent(diagram.commentManager, 'commentRemoved', () => this.redraw());

    const comments = diagram.commentManager
      .getPointComments()
      .filter(c => !c.isReply() && c.state !== 'resolved');

    return svg.g({}, ...comments.map(comment => this.renderPin(comment, props)));
  }

  private renderPin(comment: Comment, props: CanvasState) {
    // The pin is rendered inside the canvas SVG, whose viewBox already applies
    // the diagram-to-screen pan and zoom transform. Keep the pin in diagram
    // coordinates so its anchor remains attached to the comment location.
    const point = comment.position!;

    return svg.g(
      {
        transform: `translate(${point.x - PIN_SIZE / 2}, ${point.y - PIN_SIZE})`,
        style: 'cursor: pointer;',
        on: {
          mousedown: e => {
            e.preventDefault();
            e.stopPropagation();
            props.context.actions.COMMENT_EDIT?.execute({ comment });
          }
        }
      },
      INDICATORS.comment(COMMENT_PIN_BOUNDS, COMMENT_PIN_INDICATOR, 'var(--accent-3)')
    );
  }
}
