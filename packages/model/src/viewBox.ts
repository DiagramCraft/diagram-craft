import { EventEmitter } from '@diagram-craft/utils/event';
import { Extent } from '@diagram-craft/geometry/extent';
import { AbsoluteOffset, Point } from '@diagram-craft/geometry/point';
import { Transform, TransformFactory } from '@diagram-craft/geometry/transform';
import { newid } from '@diagram-craft/utils/id';

export type ViewboxEvents = {
  viewbox: { viewbox: Viewbox; type: 'pan' | 'zoom' | 'pan+zoom' };
};

export class Viewbox extends EventEmitter<ViewboxEvents> {
  #dimensions: Extent;
  #offset: AbsoluteOffset = {
    x: 0,
    y: 0
  };
  #initialized = false;

  zoomLevel = 1;
  windowSize: Extent;

  // This is mainly for debugging purposes
  readonly uid = newid();

  constructor(p: Extent | Viewbox) {
    super();

    if (p instanceof Viewbox) {
      this.#dimensions = p.dimensions;
      this.#offset = p.offset;
      this.#initialized = p.isInitialized();
      this.zoomLevel = p.zoomLevel;
      this.windowSize = p.windowSize;
    } else {
      this.#dimensions = p;
      this.windowSize = p;
    }
  }

  duplicate() {
    return new Viewbox(this);
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

  zoom(factor: number, point?: Point) {
    if (point) {
      const p = this.toDiagramPoint(point);

      this.#offset = {
        x: this.#offset.x - (p.x - this.#offset.x) * (factor - 1),
        y: this.#offset.y - (p.y - this.#offset.y) * (factor - 1)
      };
    }

    this.#dimensions = {
      w: this.#dimensions.w * factor,
      h: this.#dimensions.h * factor
    };
    this.zoomLevel *= factor;

    this.emit('viewbox', { viewbox: this, type: 'zoom' });
  }

  pan(point: Point) {
    this.#offset = point;
    this.#initialized = true;
    this.emit('viewbox', { viewbox: this, type: 'pan' });
  }

  get dimensions(): Extent {
    return this.#dimensions;
  }

  set dimensions(d: Extent) {
    this.#dimensions = d;
    this.#initialized = true;
    this.emit('viewbox', { viewbox: this, type: 'pan+zoom' });
  }

  get offset(): AbsoluteOffset {
    return this.#offset;
  }

  set offset(o: AbsoluteOffset) {
    this.#offset = o;
    this.#initialized = true;
    this.emit('viewbox', { viewbox: this, type: 'pan' });
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

  get aspectRatio() {
    return this.#dimensions.w / this.#dimensions.h;
  }
}

export const fitInAspectRatio = (w: number, h: number, aspectRatio: number) => {
  if (aspectRatio < 1) {
    return {
      w: h * aspectRatio,
      h
    };
  } else {
    return {
      w,
      h: w / aspectRatio
    };
  }
};
