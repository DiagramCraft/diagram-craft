import { EventEmitter } from '../utils/event.ts';
import { Extent } from '../geometry/extent.ts';
import { Point } from '../geometry/point.ts';
import { Transform, TransformFactory } from '../geometry/transform.ts';

export type ViewboxEvents = {
  viewbox: { viewbox: Viewbox };
};

export class Viewbox extends EventEmitter<ViewboxEvents> {
  #dimensions: Extent;
  #offset: Point = {
    x: 0,
    y: 0
  };

  zoomLevel = 1;
  windowSize: Extent;

  constructor(size: Extent) {
    super();
    this.#dimensions = size;
    this.windowSize = size;
  }

  toDiagramPoint(point: Point) {
    const transforms = TransformFactory.fromTo(
      { pos: { x: 0, y: 0 }, size: { w: this.windowSize.w, h: this.windowSize.h }, rotation: 0 },
      { pos: { x: this.#offset.x, y: this.#offset.y }, size: this.#dimensions, rotation: 0 }
    );
    return Transform.point(point, ...transforms);
  }

  toScreenPoint(point: Point) {
    const transforms = TransformFactory.fromTo(
      { pos: { x: this.#offset.x, y: this.#offset.y }, size: this.#dimensions, rotation: 0 },
      { pos: { x: 0, y: 0 }, size: { w: this.windowSize.w, h: this.windowSize.h }, rotation: 0 }
    );
    return Transform.point(point, ...transforms);
  }

  zoom(point: Point, factor: number) {
    const p = this.toDiagramPoint(point);

    this.#offset = {
      x: this.#offset.x - (p.x - this.#offset.x) * (factor - 1),
      y: this.#offset.y - (p.y - this.#offset.y) * (factor - 1)
    };
    this.#dimensions = {
      w: this.#dimensions.w * factor,
      h: this.#dimensions.h * factor
    };
    this.zoomLevel *= factor;

    this.emit('viewbox', { viewbox: this });
  }

  pan(point: Point) {
    this.#offset = point;
    this.emit('viewbox', { viewbox: this });
  }

  get dimensions(): Extent {
    return this.#dimensions;
  }

  set dimensions(d: Extent) {
    this.#dimensions = d;
    this.emit('viewbox', { viewbox: this });
  }

  get offset(): Point {
    return this.#offset;
  }

  get svgViewboxString() {
    return `${this.#offset.x} ${this.#offset.y} ${this.#dimensions.w} ${this.#dimensions.h}`;
  }

  get midpoint() {
    return {
      x: this.windowSize.w / 2,
      y: this.windowSize.h / 2
    };
  }
}
