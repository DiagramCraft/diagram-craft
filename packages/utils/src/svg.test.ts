import { describe, expect, test } from 'vitest';
import { svgAspectRatio } from './svg';

describe('svgAspectRatio', () => {
  test('returns correct ratio for a square viewBox', () => {
    expect(svgAspectRatio('<svg viewBox="0 0 100 100"></svg>')).toBe(1);
  });

  test('returns correct ratio for a landscape viewBox', () => {
    expect(svgAspectRatio('<svg viewBox="0 0 200 100"></svg>')).toBe(0.5);
  });

  test('returns correct ratio for a portrait viewBox', () => {
    expect(svgAspectRatio('<svg viewBox="0 0 100 200"></svg>')).toBe(2);
  });

  test('handles non-zero origin in viewBox', () => {
    expect(svgAspectRatio('<svg viewBox="10 20 80 40"></svg>')).toBe(0.5);
  });

  test('handles comma-separated viewBox values', () => {
    expect(svgAspectRatio('<svg viewBox="0,0,100,50"></svg>')).toBe(0.5);
  });

  test('returns 1 when viewBox attribute is missing', () => {
    expect(svgAspectRatio('<svg width="100" height="100"></svg>')).toBe(1);
  });

  test('returns 1 for an empty string', () => {
    expect(svgAspectRatio('')).toBe(1);
  });

  test('returns 1 when viewBox has fewer than 4 parts', () => {
    expect(svgAspectRatio('<svg viewBox="0 0 100"></svg>')).toBe(1);
  });

  test('returns 1 when width is zero', () => {
    expect(svgAspectRatio('<svg viewBox="0 0 0 100"></svg>')).toBe(1);
  });

  test('returns 1 when height is zero', () => {
    expect(svgAspectRatio('<svg viewBox="0 0 100 0"></svg>')).toBe(1);
  });
});
