/**
 * Simple YAML serialization utility.
 *
 * @module
 */

/**
 * Converts a JavaScript object to YAML format.
 *
 * @param obj - The object to convert
 * @param indent - Current indentation level (used internally for recursion)
 * @returns YAML string representation
 *
 * @example
 * ```ts
 * import { toYAML } from '@diagram-craft/utils/yaml';
 *
 * const obj = { name: 'test', count: 42, enabled: true };
 * console.log(toYAML(obj));
 * // name: test
 * // count: 42
 * // enabled: true
 * ```
 */
export const toYAML = (obj: unknown, indent = 0): string => {
  const prefix = '  '.repeat(indent);

  if (obj === null) return 'null';
  if (obj === undefined) return '';

  if (typeof obj === 'string') {
    if (obj === '' || needsQuoting(obj)) {
      return JSON.stringify(obj);
    }
    return obj;
  }

  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return String(obj);
  }

  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]';
    return obj
      .map(item => {
        if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
          const entries = Object.entries(item as Record<string, unknown>);
          if (entries.length === 0) return `${prefix}- {}`;

          const formatValue = (value: unknown, extraIndent: number): string => {
            if (value === null) return ' null';
            if (typeof value === 'object' && !Array.isArray(value)) {
              const nested = toYAML(value, indent + 1 + extraIndent);
              if (nested === '{}') return ' {}';
              return `\n${nested}`;
            }
            if (Array.isArray(value)) {
              if (value.length === 0) return ' []';
              return `\n${toYAML(value, indent + 1 + extraIndent)}`;
            }
            return ` ${toYAML(value, 0)}`;
          };

          const lines = entries.map(([k, v], i) => {
            const fk = needsQuoting(k) ? JSON.stringify(k) : k;
            const linePrefix = i === 0 ? `${prefix}- ` : `${prefix}  `;
            return `${linePrefix}${fk}:${formatValue(v, 1)}`;
          });
          return lines.join('\n');
        }
        return `${prefix}- ${toYAML(item, indent)}`;
      })
      .join('\n');
  }

  if (typeof obj === 'object') {
    const entries = Object.entries(obj as Record<string, unknown>);
    if (entries.length === 0) return '{}';

    return entries
      .map(([key, value]) => {
        const formattedKey = needsQuoting(key) ? JSON.stringify(key) : key;

        if (value === null) {
          return `${prefix}${formattedKey}: null`;
        }

        if (typeof value === 'object' && !Array.isArray(value)) {
          const nested = toYAML(value, indent + 1);
          if (nested === '{}') return `${prefix}${formattedKey}: {}`;
          return `${prefix}${formattedKey}:\n${nested}`;
        }

        if (Array.isArray(value)) {
          if (value.length === 0) return `${prefix}${formattedKey}: []`;
          const nested = toYAML(value, indent + 1);
          return `${prefix}${formattedKey}:\n${nested}`;
        }

        return `${prefix}${formattedKey}: ${toYAML(value, indent)}`;
      })
      .join('\n');
  }

  return String(obj);
};

const needsQuoting = (str: string): boolean => {
  if (str === '') return true;
  if (/^[\d.+-]/.test(str) && !Number.isNaN(Number(str))) return true;
  if (/^(true|false|null|yes|no|on|off)$/i.test(str)) return true;
  if (/[:#\[\]{}&*!|>'"%@`]/.test(str)) return true;
  if (/^\s|\s$/.test(str)) return true;
  return str.includes('\n');
};
