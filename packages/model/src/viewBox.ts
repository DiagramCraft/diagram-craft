import { EventEmitter } from '@diagram-craft/utils/event';
import { Extent } from '@diagram-craft/geometry/extent';
import { Point } from '@diagram-craft/geometry/point';
import { Transform, TransformFactory } from '@diagram-craft/geometry/transform';

export type ViewboxEvents = {
  viewbox: { viewbox: Viewbox };
};

export class Viewbox extends EventEmitter<ViewboxEvents> {
  #dimensions: Extent;
  #offset: Point = {
    x: 0,
    y: 0
  };
  #initialized = false;

  zoomLevel = 1;
  windowSize: Extent;

  constructor(size: Extent) {
    super();
    this.#dimensions = size;
    this.windowSize = size;
  }

  isInitialized() {
    return this.#initialized;
  }

  toDiagramPoint(point: Point) {
    const transforms = TransformFactory.fromTo(
      { x: 0, y: 0, w: this.windowSize.w, h: this.windowSize.h, r: 0 },
      { x: this.#offset.x, y: this.#offset.y, ...this.#dimensions, r: 0 }
    );
    return Transform.point(point, ...transforms);
  }

  toScreenPoint(point: Point) {
    const transforms = TransformFactory.fromTo(
      { x: this.#offset.x, y: this.#offset.y, ...this.#dimensions, r: 0 },
      { x: 0, y: 0, w: this.windowSize.w, h: this.windowSize.h, r: 0 }
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
    this.#initialized = true;
    this.emit('viewbox', { viewbox: this });
  }

  get dimensions(): Extent {
    return this.#dimensions;
  }

  set dimensions(d: Extent) {
    this.#dimensions = d;
    this.#initialized = true;
    this.emit('viewbox', { viewbox: this });
  }

  get offset(): Point {
    return this.#offset;
  }

  set offset(o: Point) {
    this.#offset = o;
    this.#initialized = true;
    this.emit('viewbox', { viewbox: this });
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
