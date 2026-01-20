/**
 * Utilities for parsing SVG path strings.
 *
 * This module provides functions for parsing SVG path data strings into structured
 * arrays of commands and parameters that can be processed programmatically.
 *
 * @example
 * ```ts
 * import { parseSvgPath } from '@diagram-craft/geometry/svgPathUtils';
 *
 * // Parse a simple path
 * const simple = parseSvgPath('M 10 20 L 30 40');
 * // Result: [['M', '10', '20'], ['L', '30', '40']]
 *
 * // Parse a path with curves
 * const curved = parseSvgPath('M 0 0 C 10 10 20 20 30 30 L 50 50');
 * // Result: [['M', '0', '0'], ['C', '10', '10', '20', '20', '30', '30'], ['L', '50', '50']]
 *
 * // Parse a complex path
 * const complex = parseSvgPath('M10,20 L30,40 Q50,60,70,80 Z');
 * // Result: [['M', '10', '20'], ['L', '30', '40'], ['Q', '50', '60', '70', '80'], ['Z']]
 *
 * // Handles both spaces and commas as separators
 * const mixed = parseSvgPath('M 10,20 L 30 40');
 * // Result: [['M', '10', '20'], ['L', '30', '40']]
 * ```
 *
 * @module
 */

/**
 * Parses an SVG path data string into an array of command arrays.
 *
 * Each command is represented as an array where the first element is the command letter
 * (M, L, C, Q, A, Z, etc.) and the remaining elements are the numeric parameters for
 * that command (as strings).
 *
 * The parser handles both spaces and commas as separators between numbers.
 *
 * @param path The SVG path data string to parse
 * @returns An array of command arrays, where each command array contains the command letter followed by its parameters
 *
 * @example
 * ```ts
 * // Move and line commands
 * parseSvgPath('M 10 20 L 30 40');
 * // Returns: [['M', '10', '20'], ['L', '30', '40']]
 *
 * // Cubic bezier curve
 * parseSvgPath('M 0 0 C 10 10 20 20 30 30');
 * // Returns: [['M', '0', '0'], ['C', '10', '10', '20', '20', '30', '30']]
 *
 * // Close path
 * parseSvgPath('M 0 0 L 10 10 Z');
 * // Returns: [['M', '0', '0'], ['L', '10', '10'], ['Z']]
 * ```
 */
export const parseSvgPath = (path: string) => {
  const commands = path.match(/[a-zA-Z][^a-zA-Z]*/g) ?? [];
  return commands.map(command => {
    const c = command.trim();
    return [
      c[0]!,
      ...(c.length > 1
        ? c
            .slice(1)
            .trim()
            .split(/[\s,]+/)
        : [])
    ];
  });
};
