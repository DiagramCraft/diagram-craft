import * as html from '../component/vdom-html';
import * as svg from '../component/vdom-svg';
import { Point } from '@diagram-craft/geometry/point';
import { Modifiers } from '../dragDropManager';
import { rawHTML } from '../component/vdom';
import styles from './canvas.css?inline';
import { isResolvableToRegularLayer } from '@diagram-craft/model/diagramLayer';
import { BaseCanvasComponent, BaseCanvasProps } from './BaseCanvasComponent';
import { createEffect } from '../component/component';
import { EventHelper } from '@diagram-craft/utils/eventHelper';
import { Viewbox, ViewboxEvents } from '@diagram-craft/model/viewBox';

/**
 * InteractiveCanvasComponent is used when displaying a canvas with basic interactivity
 * (zom/pan) and live updates in case the underlying model changes
 */
export class InteractiveCanvasComponent extends BaseCanvasComponent<CanvasProps> {
  protected defaultClassName = 'canvas';
  protected preserveAspectRatio = 'xMidYMid';

  private svgRef: SVGSVGElement | null = null;

  private viewbox: Viewbox;

  constructor(props?: CanvasProps) {
    super();
    this.currentProps = props;

    this.viewbox = new Viewbox({ w: 100, h: 100 });
  }

  protected getViewboxString(_props: CanvasProps): string | undefined {
    return this.viewbox.svgViewboxString;
  }

  private adjustViewbox() {
    const rect = this.svgRef!.getBoundingClientRect();

    this.viewbox.dimensions = {
      w: Math.floor(rect.width * this.viewbox.zoomLevel),
      h: Math.floor(rect.height * this.viewbox.zoomLevel)
    };
    this.viewbox.windowSize = {
      w: Math.floor(rect.width),
      h: Math.floor(rect.height)
    };
  }

  onAttach(_props: CanvasProps) {
    super.onAttach(_props);
    this.viewbox.dimensions = _props.diagram.viewBox.dimensions;
    this.viewbox.windowSize = _props.diagram.viewBox.windowSize;
  }

  render(props: CanvasProps) {
    const diagram = props.diagram;

    this.onEventRedraw('elementAdd', diagram);
    this.onEventRedraw('elementRemove', diagram);
    this.onEventRedraw('change', diagram);

    createEffect(() => {
      const cb = ({ viewbox }: ViewboxEvents['viewbox']) => {
        this.svgRef?.setAttribute('viewBox', viewbox.svgViewboxString);
        this.svgRef?.style.setProperty('--zoom', viewbox.zoomLevel.toString());
      };
      this.viewbox.on('viewbox', cb);
      return () => this.viewbox.off('viewbox', cb);
    }, [diagram, this.viewbox]);

    createEffect(() => {
      if (!this.svgRef) return;

      const cb = (e: WheelEvent) => {
        e.preventDefault();
        if (e.ctrlKey) {
          const delta = e.deltaY;
          const normalized = -(delta % 3 ? delta * 10 : delta / 3);
          this.viewbox.zoom(normalized > 0 ? 1 / 1.008 : 1.008, EventHelper.point(e));
        } else {
          this.viewbox.pan({
            x: this.viewbox.offset.x + e.deltaX * this.viewbox.zoomLevel,
            y: this.viewbox.offset.y + e.deltaY * this.viewbox.zoomLevel
          });
        }
      };
      this.svgRef!.addEventListener('wheel', cb);
      return () => this.svgRef!.removeEventListener('wheel', cb);
    }, [diagram, this.svgRef]);

    createEffect(() => {
      const cb = () => this.adjustViewbox();
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

export type CanvasProps = BaseCanvasProps & {
  viewBox?: string;
  onMouseDown?: (_id: string, _coord: Point, _modifiers: Modifiers) => void;
};
