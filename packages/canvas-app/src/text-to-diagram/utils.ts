import { MultiMap } from '@diagram-craft/utils/multimap';
import type { ParsedElement } from './types';

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

/**
 * Parse a props string like "fill.color=#ff0000;stroke.width=2" into a nested object
 */
export const parsePropsString = (propsStr: string): Partial<NodeProps | EdgeProps> => {
  const result: Record<string, unknown> = {};

  for (const pair of propsStr.split(';')) {
    const [key, value] = pair.split('=');
    if (!key || value === undefined) continue;

    const parts = key.split('.');

    let current: Record<string, unknown> = result;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]!;
      if (!(part in current)) {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }

    const lastKey = parts[parts.length - 1]!;
    // Try to parse as number or boolean, otherwise keep as string
    if (value === 'true') {
      current[lastKey] = true;
    } else if (value === 'false') {
      current[lastKey] = false;
    } else if (!Number.isNaN(Number(value))) {
      current[lastKey] = Number(value);
    } else {
      current[lastKey] = value;
    }
  }

  return result as Partial<NodeProps | EdgeProps>;
};

/**
 * Parse metadata string like "name=value" into an object
 */
export const parseMetadataString = (metadataStr: string): Partial<ElementMetadata> => {
  const result: Partial<ElementMetadata> = {};

  for (const pair of metadataStr.split(';')) {
    const [key, value] = pair.split('=');
    if (!key || value === undefined) continue;

    if (key === 'name') {
      result.name = value;
    }
  }

  return result;
};
