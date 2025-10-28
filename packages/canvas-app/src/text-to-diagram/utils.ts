import { MultiMap } from '@diagram-craft/utils/multimap';
import type { ParsedElement } from './parser';

/**
 * Recursively collect all element IDs and their line numbers from parsed elements
 */
export const collectElementIds = (elements: ParsedElement[]): MultiMap<string, number> => {
  const dest = new MultiMap<string, number>();

  const recurse = (elements: ParsedElement[]) => {
    for (const element of elements) {
      dest.add(element.id, element.line);

      // Recursively process children
      if (element.children) {
        recurse(element.children);
      }
    }
  };
  recurse(elements);

  return dest;
};
