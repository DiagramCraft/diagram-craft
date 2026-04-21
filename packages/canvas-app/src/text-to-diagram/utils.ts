import { MultiMap } from '@diagram-craft/utils/multimap';
import type { ParsedElement } from './types';
import type { EdgeProps, ElementMetadata, NodeProps } from '@diagram-craft/model/diagramProps';

const splitEscaped = (value: string, separator: string): string[] => {
  const parts: string[] = [];
  let current = '';
  let escaped = false;

  for (const char of value) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (char === separator) {
      parts.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  if (escaped) {
    current += '\\';
  }

  parts.push(current);
  return parts;
};

const parseAssignments = (value: string): Array<[string, string]> =>
  splitEscaped(value, ';')
    .map(pair => {
      const [key, ...rest] = splitEscaped(pair, '=');
      return key && rest.length > 0 ? [key, rest.join('=')] : undefined;
    })
    .filter((entry): entry is [string, string] => entry !== undefined);

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

  for (const [key, value] of parseAssignments(propsStr)) {
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

  for (const [key, value] of parseAssignments(metadataStr)) {
    if (key === 'name') {
      result.name = value;
    }
  }

  return result;
};
