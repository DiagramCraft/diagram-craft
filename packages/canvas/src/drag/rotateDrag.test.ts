import { describe, expect, test } from 'vitest';
import { Angle } from '@diagram-craft/geometry/angle';
import { calculateTargetRotationAngle } from './rotateDrag';

describe('calculateTargetRotationAngle', () => {
  test('keeps the current rotation when the drag starts on the handle', () => {
    const center = { x: 100, y: 100 };
    const initialOffset = { x: 140, y: 60 };
    const initialRotation = Angle.toRad(35);

    const target = calculateTargetRotationAngle(
      center,
      initialOffset,
      initialOffset,
      initialRotation
    );

    expect(target).toBeCloseTo(initialRotation, 6);
  });

  test('uses the shortest angular delta across the wraparound boundary', () => {
    const center = { x: 0, y: 0 };
    const initialRotation = Angle.toRad(15);
    const initialOffset = { x: Math.cos(Angle.toRad(170)), y: Math.sin(Angle.toRad(170)) };
    const currentOffset = { x: Math.cos(Angle.toRad(-170)), y: Math.sin(Angle.toRad(-170)) };

    const target = calculateTargetRotationAngle(
      center,
      initialOffset,
      currentOffset,
      initialRotation
    );

    expect(target).toBeCloseTo(Angle.toRad(35), 6);
  });
});
