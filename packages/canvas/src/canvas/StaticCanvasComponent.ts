import { InteractiveCanvasProps } from './InteractiveCanvasComponent';
import { BaseCanvasComponent } from './BaseCanvasComponent';
import * as html from '../component/vdom-html';
import * as svg from '../component/vdom-svg';
import { rawHTML } from '../component/vdom';
import { isResolvableToRegularLayer } from '@diagram-craft/model/diagramLayer';
import styles from './canvas.css?inline';

export type StaticCanvasProps = Omit<InteractiveCanvasProps, 'viewbox'> & { viewbox?: string };

/**
 * The StaticCanvasComponent is intended for displaying a canvas that neither updates
 * in case the underlying diagram changes nor any type of interactivity like zoom, pan etc
 */
export class StaticCanvasComponent extends BaseCanvasComponent<StaticCanvasProps> {
  protected defaultClassName = 'canvas';
  protected preserveAspectRatio = 'xMidYMid';

  constructor(props?: StaticCanvasProps) {
    super();
    this.currentProps = props;
  }

  protected getViewboxString(props: StaticCanvasProps): string | undefined {
    return props.viewbox;
  }

  render(props: StaticCanvasProps) {
    const diagram = props.diagram;

    const viewBox = this.getViewboxString(props);

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

  protected getMemoKey(props: StaticCanvasProps): unknown | undefined {
    return {
      id: props.diagram.id,
      width: props.width,
      height: props.height,
      viewBox: props.viewbox,
      onClick: props.onClick,
      className: props.className
    };
  }
}
