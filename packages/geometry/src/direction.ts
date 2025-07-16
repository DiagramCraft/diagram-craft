import { Point } from './point';
import { Angle } from './angle';
import { VERIFY_NOT_REACHED } from '@diagram-craft/utils/assert';

/**
 * Represents a cardinal direction using single-letter abbreviations.
 * - 'n': North
 * - 's': South
 * - 'w': West
 * - 'e': East
 */
export type Direction = 'n' | 's' | 'w' | 'e';

/**
 * Represents a cardinal direction using full names.
 * - 'north': North
 * - 'south': South
 * - 'west': West
 * - 'east': East
 */
export type FullDirection = 'north' | 'south' | 'west' | 'east';

/**
 * Asserts that a value is either a valid FullDirection or undefined.
 *
 * @param value - The value to check
 * @throws Error if the value is neither a valid FullDirection nor undefined
 */
export function assertFullDirectionOrUndefined(
  value: unknown
): asserts value is FullDirection | undefined {
  if (value === undefined) return;
  if (typeof value !== 'string') VERIFY_NOT_REACHED();

  const validDirections: ReadonlyArray<FullDirection> = ['north', 'south', 'east', 'west'];
  if (!validDirections.includes(value as FullDirection)) {
    throw new Error(`Invalid direction: ${value}`);
  }
}

export const Direction = {
  /**
   * Returns the opposite cardinal direction.
   *
   * @param d - The direction to get the opposite of
   * @returns The opposite direction
   */
  opposite(d: Direction): Direction {
    switch (d) {
      case 'n':
        return 's';
      case 's':
        return 'n';
      case 'w':
        return 'e';
      case 'e':
        return 'w';
      default:
        return VERIFY_NOT_REACHED();
    }
  },

  /**
   * Returns an array of all cardinal directions.
   *
   * @returns An array containing all cardinal directions
   */
  all: (): ReadonlyArray<Direction> => {
    return ['n', 's', 'w', 'e'];
  },

  /**
   * Determines the cardinal direction from a vector.
   *
   * @param p - The point representing the vector
   * @returns The cardinal direction ('n', 's', 'w', 'e')
   */
  fromVector: (p: Point): Direction => {
    if (Math.abs(p.x) > Math.abs(p.y)) {
      return p.x < 0 ? 'w' : 'e';
    } else {
      // This handles both when |y| > |x| and when |y| = |x|
      return p.y < 0 ? 'n' : 's';
    }
  },

  /**
   * Determines the cardinal direction from an angle in radians.
   *
   * @param angle - The angle in radians (0 = east, PI/2 = north, PI = west, 3PI/2 = south)
   * @param inverted - If true, inverts the north-south directions (useful for some coordinate systems)
   * @returns The cardinal direction
   */
  fromAngle: (angle: number, inverted = false): Direction => {
    const a = Angle.normalize(angle);

    if (a > Math.PI / 4 && a < (3 * Math.PI) / 4) {
      return inverted ? 's' : 'n';
    } else if (a > (3 * Math.PI) / 4 && a < (5 * Math.PI) / 4) {
      return 'w';
    } else if (a > (5 * Math.PI) / 4 && a < (7 * Math.PI) / 4) {
      return inverted ? 'n' : 's';
    } else {
      return 'e';
    }
  },

  /**
   * Converts a cardinal direction to an angle in radians.
   *
   * @param d - The cardinal direction
   * @param inverted - If true, inverts the north-south directions (useful for some coordinate systems)
   * @returns The angle in radians (0 = east, PI/2 = north, PI = west, 3PI/2 = south)
   */
  toAngle: (d: Direction, inverted = false): number => {
    switch (d) {
      case 'n':
        return inverted ? (3 * Math.PI) / 2 : Math.PI / 2;
      case 's':
        return inverted ? Math.PI / 2 : (3 * Math.PI) / 2;
      case 'w':
        return Math.PI;
      case 'e':
        return 0;
      default:
        return VERIFY_NOT_REACHED();
    }
  }
};
