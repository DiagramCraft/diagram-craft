/**
 * String template variable substitution utilities.
 *
 * @example
 * ```ts
 * import { applyTemplate } from '@diagram-craft/utils/template';
 *
 * const template = 'Name: %name%, Age: %age%';
 * const result = applyTemplate(template, { name: 'Alice', age: 30 });
 * // Result: 'Name: Alice, Age: 30'
 * ```
 *
 * @module
 */

import { FlatObject } from '@diagram-craft/utils/flatObject';

/**
 * Applies template variable substitution to a text string.
 *
 * Template variables are defined using the pattern `%variableName%` and are replaced
 * with corresponding values from the props object. If a variable is not found in props,
 * it is replaced with an empty string.
 *
 * @param text - The template string containing variables in the format `%variableName%`
 * @param props - An object containing key-value pairs for variable substitution
 * @param applyLinebreaks - If true, converts newline characters (\n) to HTML line breaks (<br>)
 * @returns The processed string with all template variables replaced
 *
 * @example
 * ```typescript
 * const template = 'Hello %name%! You have %count% messages.';
 * const result = applyTemplate(template, { name: 'Alice', count: 5 });
 * // Returns: 'Hello Alice! You have 5 messages.'
 * ```
 */
export const applyTemplate = (
  text: string | undefined,
  props: FlatObject,
  applyLinebreaks = false
) => {
  text = text ?? '';
  text = applyLinebreaks ? applyLineBreaks(text) : text;
  for (const match of text.matchAll(/%(\w+)%/g)) {
    const key = match[1]!;
    const value = props[key];
    text = text.replace(match[0], value ? value.toString() : '');
  }
  return text;
};

/**
 * Converts newline characters in a string to HTML line break tags.
 *
 * @param s - The input string to process
 * @returns The processed string with all `\n` characters replaced with `<br>` tags
 *
 * @example
 * ```typescript
 * const text = 'Line 1\nLine 2\nLine 3';
 * const result = applyLineBreaks(text);
 * // Returns: 'Line 1<br>Line 2<br>Line 3'
 * ```
 */
export const applyLineBreaks = (s: string | undefined) => {
  return (s ?? '').replaceAll('\n', '<br>');
};
