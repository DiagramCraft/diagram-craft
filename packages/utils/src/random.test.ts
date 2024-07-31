import { describe, expect, test } from 'vitest';
import { Random } from './random';

describe('Random', () => {
  test('generates consistent float values with the same seed', () => {
    const random1 = new Random(12345);
    const random2 = new Random(12345);
    expect(random1.nextFloat()).toBe(random2.nextFloat());
  });

  test('generates different float values with different seeds', () => {
    const random1 = new Random(12345);
    const random2 = new Random(54321);
    expect(random1.nextFloat()).not.toBe(random2.nextFloat());
  });

  test('generates float values between 0 and 1', () => {
    const random = new Random(12345);
    const value = random.nextFloat();
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(1);
  });

  test('generates values within specified range', () => {
    const random = new Random(12345);
    const value = random.nextRange(10, 20);
    expect(value).toBeGreaterThanOrEqual(10);
    expect(value).toBeLessThan(20);
  });

  test('generates boolean values', () => {
    const random = new Random(12345);
    const value = random.nextBoolean();
    expect(typeof value).toBe('boolean');
  });

  test('generates different sequences with different seeds', () => {
    const random1 = new Random(12345);
    const random2 = new Random(54321);
    const sequence1 = [random1.nextFloat(), random1.nextFloat(), random1.nextFloat()];
    const sequence2 = [random2.nextFloat(), random2.nextFloat(), random2.nextFloat()];
    expect(sequence1).not.toEqual(sequence2);
  });

  test('generates consistent sequences with the same seed', () => {
    const random1 = new Random(12345);
    const random2 = new Random(12345);
    const sequence1 = [random1.nextFloat(), random1.nextFloat(), random1.nextFloat()];
    const sequence2 = [random2.nextFloat(), random2.nextFloat(), random2.nextFloat()];
    expect(sequence1).toEqual(sequence2);
  });
});
