/**
 * BEM-style class name generation utility.
 *
 * @example
 * ```ts
 * import { $c } from '@diagram-craft/utils/classname';
 *
 * const className = $c('button', { large: true, disabled: false });
 * // Returns: 'button button--large'
 * ```
 *
 * @module
 */

/**
 * Generates a BEM (Block Element Modifier) style class name based on the base class name and a set of modifiers.
 *
 * @param base - The base class name.
 * @param modifiers - An object where the keys are the modifier names and the values are booleans indicating whether the modifier should be included.
 * @returns A string containing the generated class name.
 *
 * @example
 * // returns 'button button--large'
 * $c('button', { large: true, small: false });
 *
 * @example
 * // returns 'card card--active card--highlighted'
 * $c('card', { active: true, highlighted: true, disabled: false });
 */
export const $c = (base: string, modifiers: Record<string, boolean>) => {
  const classes = Object.entries(modifiers)
    .filter(([_, value]) => value)
    .map(([key, _]) => `${base}--${key}`);
  return [base, ...classes].join(' ');
};
