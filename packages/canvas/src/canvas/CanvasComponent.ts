import * as svg from '../component/vdom-svg';
import * as html from '../component/vdom-html';
import { Point } from '@diagram-craft/geometry/point';
import { Modifiers } from '../dragDropManager';
import { rawHTML } from '../component/vdom';
import styles from './canvas.css?inline';
import { isResolvableToRegularLayer } from '@diagram-craft/model/diagramLayer';
import { BaseCanvasComponent, BaseCanvasProps } from './BaseCanvasComponent';

// TODO: Change CanvasComponent to InteractiveCanvasComponent
//       Add capabilities/callback to InteractiveCanvasComponent

export class CanvasComponent extends BaseCanvasComponent<CanvasProps> {
  protected defaultClassName = 'canvas';
  protected preserveAspectRatio = 'xMidYMid';

  constructor(props?: CanvasProps) {
    super();
    this.currentProps = props;
  }

  protected viewBox(props: CanvasProps): string | undefined {
    return props.viewBox;
  }

  render(props: CanvasProps) {
    const diagram = props.diagram;

    this.onEventRedraw('elementAdd', diagram);
    this.onEventRedraw('elementRemove', diagram);
    this.onEventRedraw('change', diagram);

    const viewBox = this.viewBox(props);

    return html.svg(
      {
        id: props.id,
        class: this.getClassName(props),

        ...this.getDimension(props),

        preserveAspectRatio: this.preserveAspectRatio,
        style: `user-select: none`,
        ...(viewBox ? { viewBox: viewBox } : {}),
        on: {
          click: e => props.onClick?.(e)
        }
      },
      [
        svg.style({}, rawHTML(styles)),
        this.svgFilterDefs(),

        svg.g(
          {},
          ...diagram.layers.visible.flatMap(layer => {
            if (!isResolvableToRegularLayer(layer)) return null;
            return this.renderLayer(layer, diagram, props.onMouseDown, undefined);
          })
        )
      ]
    );
  }
}

export type CanvasProps = BaseCanvasProps & {
  viewBox?: string;
  onMouseDown?: (_id: string, _coord: Point, _modifiers: Modifiers) => void;
};
