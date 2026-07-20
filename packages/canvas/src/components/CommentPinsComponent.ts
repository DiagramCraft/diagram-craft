import type { CanvasState } from '../canvas/EditableCanvasComponent';
import { Component, onEvent } from '../component/component';
import * as svg from '../component/vdom-svg';
import { PathListBuilder, fromUnitLCS } from '@diagram-craft/geometry/pathListBuilder';
import { _p, Point } from '@diagram-craft/geometry/point';
import type { Comment } from '@diagram-craft/model/comment';

const PIN_SIZE = 20;

const pinPath = () => {
  const b = new PathListBuilder().withTransform(
    fromUnitLCS({ x: 0, y: 0, w: PIN_SIZE, h: PIN_SIZE, r: 0 })
  );

  b.moveTo(Point.of(0, 0.1));
  b.arcTo(_p(0.1, 0), 0.1, 0.1, 0, 0, 1);
  b.lineTo(_p(0.9, 0));
  b.arcTo(_p(1, 0.1), 0.1, 0.1, 0, 0, 1);
  b.lineTo(_p(1, 0.6));
  b.arcTo(_p(0.9, 0.7), 0.1, 0.1, 0, 0, 1);
  b.lineTo(_p(0.7, 0.7));
  b.lineTo(_p(0.9, 1));
  b.lineTo(_p(0.4, 0.7));
  b.lineTo(_p(0.1, 0.7));
  b.arcTo(_p(0, 0.6), 0.1, 0.1, 0, 0, 1);
  b.close();

  return b.getPaths().asSvgPath();
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
        style: 'cursor: pointer;'
      },
      svg.path({
        d: pinPath(),
        stroke: 'var(--accent-9)',
        fill: 'var(--accent-3)',
        'stroke-width': 1.5,
        on: {
          mousedown: e => {
            e.preventDefault();
            e.stopPropagation();
            props.context.actions.COMMENT_EDIT?.execute({ comment });
          }
        }
      })
    );
  }
}
