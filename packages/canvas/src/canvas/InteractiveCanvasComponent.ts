import * as html from '../component/vdom-html';
import * as svg from '../component/vdom-svg';
import { Point } from '@diagram-craft/geometry/point';
import { Modifiers } from '../dragDropManager';
import { rawHTML } from '../component/vdom';
import styles from './canvas.css?inline';
import { isResolvableToRegularLayer } from '@diagram-craft/model/diagramLayerRegular';
import { BaseCanvasComponent, BaseCanvasProps } from './BaseCanvasComponent';
import { createEffect } from '../component/component';
import { EventHelper } from '@diagram-craft/utils/eventHelper';
import { Viewbox, ViewboxEvents } from '@diagram-craft/model/viewBox';
import { Diagram } from '@diagram-craft/model/diagram';

export const createUpdateOnViewboxChangeEffect = (
  svgRef: () => SVGSVGElement | null,
  viewbox: Viewbox,
  diagram: Diagram
) => {
  createEffect(() => {
    const cb = ({ viewbox }: ViewboxEvents['viewbox']) => {
      svgRef()?.setAttribute('viewBox', viewbox.svgViewboxString);
      svgRef()?.style.setProperty('--zoom', viewbox.zoomLevel.toString());
    };
    viewbox.on('viewbox', cb);
    return () => viewbox.off('viewbox', cb);
  }, [diagram, viewbox]);
};

export const createZoomPanOnMouseEventEffect = (
  svgRef: () => SVGSVGElement | null,
  viewbox: Viewbox,
  diagram: Diagram
) => {
  createEffect(() => {
    const ref = svgRef();
    if (!ref) return;

    const cb = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey) {
        const delta = e.deltaY;
        const normalized = -(delta % 3 ? delta * 10 : delta / 3);
        viewbox.zoom(normalized > 0 ? 1 / 1.008 : 1.008, EventHelper.point(e));
      } else {
        viewbox.pan({
          x: viewbox.offset.x + e.deltaX * viewbox.zoomLevel,
          y: viewbox.offset.y + e.deltaY * viewbox.zoomLevel
        });
      }
    };
    ref.addEventListener('wheel', cb);
    return () => ref.removeEventListener('wheel', cb);
  }, [diagram, svgRef()]);
};

/**
 * InteractiveCanvasComponent is used when displaying a canvas with basic interactivity
 * (zom/pan) and live updates in case the underlying model changes
 */
export class InteractiveCanvasComponent extends BaseCanvasComponent<InteractiveCanvasProps> {
  protected defaultClassName = 'canvas';
  protected preserveAspectRatio = 'xMidYMid';

  private svgRef: SVGSVGElement | null = null;

  private readonly viewbox: Viewbox;

  constructor(props?: InteractiveCanvasProps) {
    super();
    this.currentProps = props;

    this.viewbox = new Viewbox({ w: 100, h: 100 });
  }

  protected getViewboxString(props: InteractiveCanvasProps): string | undefined {
    const viewbox = props.viewbox ?? this.viewbox;
    return viewbox.svgViewboxString;
  }

  private adjustViewbox(viewbox: Viewbox) {
    const rect = this.svgRef!.getBoundingClientRect();

    viewbox.dimensions = {
      w: Math.floor(rect.width * viewbox.zoomLevel),
      h: Math.floor(rect.height * viewbox.zoomLevel)
    };
    viewbox.windowSize = {
      w: Math.floor(rect.width),
      h: Math.floor(rect.height)
    };
  }

  onAttach(props: InteractiveCanvasProps) {
    super.onAttach(props);

    if (!props.viewbox) {
      this.viewbox.dimensions = props.diagram.viewBox.dimensions;
      this.viewbox.windowSize = props.diagram.viewBox.windowSize;
    }
  }

  render(props: InteractiveCanvasProps) {
    const diagram = props.diagram;
    const viewbox = props.viewbox ?? this.viewbox;

    this.onEventRedraw('elementAdd', diagram);
    this.onEventRedraw('elementRemove', diagram);
    this.onEventRedraw('change', diagram);

    createUpdateOnViewboxChangeEffect(() => this.svgRef, viewbox, diagram);

    createZoomPanOnMouseEventEffect(() => this.svgRef, viewbox, diagram);

    createEffect(() => {
      const cb = () => this.adjustViewbox(viewbox);
      window.addEventListener('resize', cb);
      return () => window.removeEventListener('resize', cb);
    }, [diagram]);

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
        },
        hooks: {
          onInsert: node => {
            this.svgRef = node.el! as SVGSVGElement;

            // Note: this causes an extra redraw, but it's necessary to ensure that
            //       the wheel events (among others) are bound correctly
            this.redraw();
          },
          onRemove: () => {
            this.svgRef = null;
          }
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

export type InteractiveCanvasProps = BaseCanvasProps & {
  viewbox?: Viewbox;
  onMouseDown?: (_id: string, _coord: Point, _modifiers: Modifiers) => void;
};
