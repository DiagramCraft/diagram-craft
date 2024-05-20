import { describe, expect, test } from 'vitest';
import { LocalCoordinateSystem } from './lcs';

describe('LocalCoordinateSystem', () => {
  describe('only rotation', () => {
    test('toLocal ', () => {
      // 1. Box on origin
      const lcs = new LocalCoordinateSystem({ x: 0, y: 0, w: 20, h: 30, r: Math.PI / 6 });
      expect(lcs.toLocal({ x: 0, y: 0 }).x).toBeCloseTo(0);
      expect(lcs.toLocal({ x: 0, y: 0 }).y).toBeCloseTo(0);
      expect(lcs.toLocal({ x: 2.32, y: 35.98 }).x).toBeCloseTo(20);
      expect(lcs.toLocal({ x: 2.32, y: 35.98 }).y).toBeCloseTo(30);
    });

    test('toGlobal ', () => {
      // 1. Box on origin
      const lcs = new LocalCoordinateSystem({ x: 0, y: 0, w: 20, h: 30, r: Math.PI / 6 });
      expect(lcs.toGlobal({ x: 0, y: 0 }).x).toBeCloseTo(0);
      expect(lcs.toGlobal({ x: 0, y: 0 }).y).toBeCloseTo(0);
      expect(lcs.toGlobal({ x: 20, y: 30 }).x).toBeCloseTo(2.32);
      expect(lcs.toGlobal({ x: 20, y: 30 }).y).toBeCloseTo(35.98);
    });
  });

  describe('only translations', () => {
    test('toLocal', () => {
      const lcs = new LocalCoordinateSystem({ x: 10, y: 15, w: 20, h: 30, r: 0 });
      expect(lcs.toLocal({ x: 10, y: 15 }).x).toBeCloseTo(0);
      expect(lcs.toLocal({ x: 10, y: 15 }).y).toBeCloseTo(0);
      expect(lcs.toLocal({ x: 11, y: 16 }).x).toBeCloseTo(1);
      expect(lcs.toLocal({ x: 11, y: 16 }).y).toBeCloseTo(1);
    });

    test('toGlobal', () => {
      const lcs = new LocalCoordinateSystem({ x: 10, y: 15, w: 20, h: 30, r: 0 });
      expect(lcs.toGlobal({ x: 0, y: 0 }).x).toBeCloseTo(10);
      expect(lcs.toGlobal({ x: 0, y: 0 }).y).toBeCloseTo(15);
      expect(lcs.toGlobal({ x: 1, y: 1 }).x).toBeCloseTo(11);
      expect(lcs.toGlobal({ x: 1, y: 1 }).y).toBeCloseTo(16);
    });
  });

  describe('scale', () => {
    test('toGlobal', () => {
      const lcs = new LocalCoordinateSystem(
        { x: 10, y: 15, w: 20, h: 30, r: 0 },
        [0, 1],
        [0, 1],
        false
      );
      expect(lcs.toGlobal({ x: 1, y: 0 }).y).toBeCloseTo(15);
      expect(lcs.toGlobal({ x: 1, y: 1 }).y).toBeCloseTo(45);

      expect(lcs.toGlobal({ x: 0, y: 1 }).x).toBeCloseTo(10);
      expect(lcs.toGlobal({ x: 1, y: 1 }).x).toBeCloseTo(30);
    });

    test('toLocal', () => {
      const lcs = new LocalCoordinateSystem(
        { x: 10, y: 15, w: 20, h: 30, r: 0 },
        [0, 1],
        [0, 1],
        false
      );
      expect(lcs.toLocal({ x: 10, y: 15 }).x).toBeCloseTo(0);
      expect(lcs.toLocal({ x: 10, y: 15 }).y).toBeCloseTo(0);

      expect(lcs.toLocal({ x: 30, y: 45 }).x).toBeCloseTo(1);
      expect(lcs.toLocal({ x: 30, y: 45 }).y).toBeCloseTo(1);
    });
  });

  describe('invert', () => {
    test('toGlobal', () => {
      const lcs = new LocalCoordinateSystem(
        { x: 10, y: 15, w: 20, h: 30, r: 0 },
        [0, 1],
        [0, 1],
        true
      );
      expect(lcs.toGlobal({ x: 1, y: 0 }).y).toBeCloseTo(45);
      expect(lcs.toGlobal({ x: 1, y: 1 }).y).toBeCloseTo(15);

      expect(lcs.toGlobal({ x: 0, y: 1 }).x).toBeCloseTo(10);
      expect(lcs.toGlobal({ x: 1, y: 1 }).x).toBeCloseTo(30);
    });

    test('toLocal', () => {
      const lcs = new LocalCoordinateSystem(
        { x: 10, y: 15, w: 20, h: 30, r: 0 },
        [0, 1],
        [0, 1],
        true
      );
      expect(lcs.toLocal({ x: 10, y: 15 }).x).toBeCloseTo(0);
      expect(lcs.toLocal({ x: 10, y: 45 }).y).toBeCloseTo(0);

      expect(lcs.toLocal({ x: 30, y: 45 }).x).toBeCloseTo(1);
      expect(lcs.toLocal({ x: 30, y: 15 }).y).toBeCloseTo(1);
    });
  });
});
