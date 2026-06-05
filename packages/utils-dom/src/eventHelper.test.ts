import { describe, expect, it } from 'vitest';
import { EventHelper } from './eventHelper';
import { Point } from '@diagram-craft/geometry/point';

describe('EventHelper', () => {
  describe('point', () => {
    it('should return a point with x and y coordinates from event offsetX and offsetY', () => {
      // Setup
      const event = { offsetX: 10, offsetY: 20 };

      // Act
      const result = EventHelper.point(event);

      // Assert
      expect(result).toEqual({ x: 10, y: 20 });
    });

    it('should handle zero values', () => {
      // Setup
      const event = { offsetX: 0, offsetY: 0 };

      // Act
      const result = EventHelper.point(event);

      // Assert
      expect(result).toEqual({ x: 0, y: 0 });
    });

    it('should handle negative values', () => {
      // Setup
      const event = { offsetX: -10, offsetY: -20 };

      // Act
      const result = EventHelper.point(event);

      // Assert
      expect(result).toEqual({ x: -10, y: -20 });
    });
  });

  describe('pointWithRespectTo method', () => {
    it('should calculate point position relative to an HTML element using event', () => {
      // Setup
      const event = { clientX: 100, clientY: 200 };
      const element = {
        getBoundingClientRect: () => ({
          left: 50,
          top: 100
        })
      } as HTMLElement;

      // Act
      const result = EventHelper.pointWithRespectTo(event, element);

      // Assert
      expect(result).toEqual({ x: 50, y: 100 });
    });

    it('should calculate point position relative to an SVG element using event', () => {
      // Setup
      const event = { clientX: 150, clientY: 250 };
      const element = {
        getBoundingClientRect: () => ({
          left: 50,
          top: 100
        })
      } as SVGElement;

      // Act
      const result = EventHelper.pointWithRespectTo(event, element);

      // Assert
      expect(result).toEqual({ x: 100, y: 150 });
    });

    it('should calculate point position relative to an element using Point object', () => {
      // Setup
      const point: Point = { x: 200, y: 300 };
      const element = {
        getBoundingClientRect: () => ({
          left: 50,
          top: 100
        })
      } as HTMLElement;

      // Act
      const result = EventHelper.pointWithRespectTo(point, element);

      // Assert
      expect(result).toEqual({ x: 150, y: 200 });
    });

    it('should handle zero values in event', () => {
      // Setup
      const event = { clientX: 0, clientY: 0 };
      const element = {
        getBoundingClientRect: () => ({
          left: 0,
          top: 0
        })
      } as HTMLElement;

      // Act
      const result = EventHelper.pointWithRespectTo(event, element);

      // Assert
      expect(result).toEqual({ x: 0, y: 0 });
    });

    it('should handle negative values in event', () => {
      // Setup
      const event = { clientX: -10, clientY: -20 };
      const element = {
        getBoundingClientRect: () => ({
          left: 50,
          top: 100
        })
      } as HTMLElement;

      // Act
      const result = EventHelper.pointWithRespectTo(event, element);

      // Assert
      expect(result).toEqual({ x: -60, y: -120 });
    });

    it('should handle negative values in element position', () => {
      // Setup
      const event = { clientX: 100, clientY: 200 };
      const element = {
        getBoundingClientRect: () => ({
          left: -50,
          top: -100
        })
      } as HTMLElement;

      // Act
      const result = EventHelper.pointWithRespectTo(event, element);

      // Assert
      expect(result).toEqual({ x: 150, y: 300 });
    });
  });
});
