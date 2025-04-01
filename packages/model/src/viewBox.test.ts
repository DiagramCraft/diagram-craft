import { beforeEach, describe, expect, it } from 'vitest';
import { fitInAspectRatio, Viewbox } from './viewBox';

describe('Viewbox', () => {
  let viewbox: Viewbox;

  beforeEach(() => {
    const size = { w: 100, h: 100 };
    viewbox = new Viewbox(size);
  });

  describe('isInitialized()', () => {
    it('should return false by default after creation', () => {
      expect(viewbox.isInitialized()).toBe(false);
    });

    it('should return true after setting offset', () => {
      viewbox.offset = { x: 10, y: 20 };
      expect(viewbox.isInitialized()).toBe(true);
    });

    it('should return true after panning', () => {
      viewbox.pan({ x: 10, y: 20 });
      expect(viewbox.isInitialized()).toBe(true);
    });

    it('should return true after setting dimensions', () => {
      viewbox.dimensions = { w: 50, h: 50 };
      expect(viewbox.isInitialized()).toBe(true);
    });
  });

  describe('toDiagramPoint()', () => {
    it('should correctly translate a point from screen to diagram coordinates', () => {
      viewbox.offset = { x: 10, y: 20 };
      viewbox.dimensions = { w: 200, h: 200 };
      const point = { x: 50, y: 50 };
      expect(viewbox.toDiagramPoint(point)).toEqual({ x: 110, y: 120 });
    });

    it('should handle zooming correctly', () => {
      viewbox.zoom(2);
      const point = { x: 50, y: 50 };
      expect(viewbox.toDiagramPoint(point)).toEqual({ x: 100, y: 100 });
    });

    it('should handle zero offset correctly', () => {
      const point = { x: 10, y: 10 };
      expect(viewbox.toDiagramPoint(point)).toEqual(point);
    });

    it('should correctly apply offset and dimensions transformations', () => {
      viewbox.offset = { x: 5, y: 10 };
      viewbox.dimensions = { w: 400, h: 400 };
      const point = { x: 20, y: 30 };
      expect(viewbox.toDiagramPoint(point)).toEqual({ x: 85, y: 130 });
    });
  });

  describe('toScreenPoint()', () => {
    it('should correctly translate a point from diagram to screen coordinates with default parameters', () => {
      const point = { x: 50, y: 50 };
      const result = viewbox.toScreenPoint(point);
      expect(result).toEqual(point); // No transformations applied by default
    });

    it('should reflect changes in offset when calculating screen coordinates', () => {
      viewbox.offset = { x: 10, y: 20 };
      const point = { x: 60, y: 70 };
      const result = viewbox.toScreenPoint(point);
      expect(result).toEqual({ x: 50, y: 50 }); // Reversed offset transformation
    });

    it('should handle zoom levels correctly when calculating screen coordinates', () => {
      viewbox.zoom(2); // Zoom in by a factor of 2
      const point = { x: 40, y: 40 };
      const result = viewbox.toScreenPoint(point);
      expect(result).toEqual({ x: 20, y: 20 }); // Zoom halves the screen point
    });

    it('should apply combined transformations (offset and zoom)', () => {
      viewbox.offset = { x: 10, y: 20 };
      viewbox.zoom(0.5); // Zoom out by a factor of 0.5
      const point = { x: -20, y: -20 };
      const result = viewbox.toScreenPoint(point);
      expect(result).toEqual({ x: -60, y: -80 }); // Adjusted for zoom and offset
    });
  });

  describe('svgViewboxString()', () => {
    it('should return the default SVG viewbox string after creation', () => {
      expect(viewbox.svgViewboxString).toBe('0 0 100 100');
    });

    it('should update the viewbox string when offset is changed', () => {
      viewbox.offset = { x: 10, y: 20 };
      expect(viewbox.svgViewboxString).toBe('10 20 100 100');
    });
  });

  describe('midpoint()', () => {
    it('should return the correct midpoint based on the window size', () => {
      expect(new Viewbox({ w: 80, h: 60 }).midpoint).toEqual({ x: 40, y: 30 });
    });

    it('should return the correct midpoint for square window size', () => {
      expect(new Viewbox({ w: 100, h: 100 }).midpoint).toEqual({ x: 50, y: 50 });
    });

    it('should return (0, 0) for window size of 0 x 0', () => {
      expect(new Viewbox({ w: 0, h: 0 }).midpoint).toEqual({ x: 0, y: 0 });
    });
  });

  describe('aspectRatio()', () => {
    it('should return 1 for default square dimensions', () => {
      expect(new Viewbox({ w: 100, h: 100 }).aspectRatio).toBe(1);
    });

    it('should reflect correct aspect ratio for a wide rectangle', () => {
      expect(new Viewbox({ w: 300, h: 100 }).aspectRatio).toBe(3);
    });

    it('should reflect correct aspect ratio for a tall rectangle', () => {
      expect(new Viewbox({ w: 100, h: 300 }).aspectRatio).toBeCloseTo(0.333, 3);
    });

    it('should return Infinity when height is 0', () => {
      expect(new Viewbox({ w: 100, h: 0 }).aspectRatio).toBe(Infinity);
    });

    it('should return 0 when width is 0', () => {
      expect(new Viewbox({ w: 0, h: 100 }).aspectRatio).toBe(0);
    });
  });

  describe('dimensions()', () => {
    it('should return the initial dimensions provided to the constructor', () => {
      expect(new Viewbox({ w: 100, h: 50 }).dimensions).toEqual({ w: 100, h: 50 });
    });

    it('should update dimensions correctly when set', () => {
      const viewbox = new Viewbox({ w: 100, h: 50 });
      viewbox.dimensions = { w: 200, h: 150 };
      expect(viewbox.dimensions).toEqual({ w: 200, h: 150 });
    });
  });

  describe('offset()', () => {
    it('should start with the default offset of (0, 0)', () => {
      expect(new Viewbox({ w: 100, h: 100 }).offset).toEqual({ x: 0, y: 0 });
    });

    it('should correctly set the offset and trigger initialization', () => {
      const viewbox = new Viewbox({ w: 100, h: 100 });
      viewbox.offset = { x: 10, y: 20 };
      expect(viewbox.offset).toEqual({ x: 10, y: 20 });
      expect(viewbox.isInitialized()).toBe(true);
    });
  });
});

describe('fitInAspectRatio()', () => {
  it('should scale proportionally when aspectRatio < 1', () => {
    const result = fitInAspectRatio(200, 100, 0.5);
    expect(result).toEqual({ w: 50, h: 100 });
  });

  it('should scale proportionally when aspectRatio >= 1', () => {
    const result = fitInAspectRatio(200, 100, 2);
    expect(result).toEqual({ w: 200, h: 100 });
  });

  it('should handle zero width and height correctly', () => {
    const result = fitInAspectRatio(0, 0, 1.5);
    expect(result).toEqual({ w: 0, h: 0 });
  });

  it('should return original dimensions when aspectRatio is 1', () => {
    const result = fitInAspectRatio(100, 100, 1);
    expect(result).toEqual({ w: 100, h: 100 });
  });
});
