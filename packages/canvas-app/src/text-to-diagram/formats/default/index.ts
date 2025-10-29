import type { DiagramFormat } from '../../types';
import { defaultParser } from './parser';
import { defaultSerializer } from './serializer';
import { defaultSyntaxHighlighter } from './syntaxHighlighter';

/**
 * Default diagram text format
 *
 * This format uses a custom syntax designed for Diagram Craft.
 * See parser.ts for complete grammar documentation.
 *
 * Example:
 * ```
 * node1: rect "Hello"
 * node2: circle "World"
 * e1: edge node1 -> node2 "connects to"
 * ```
 */
export const defaultFormat: DiagramFormat = {
  id: 'default',
  name: 'Default',
  description: 'Default Diagram Craft text format',
  parser: defaultParser,
  serializer: defaultSerializer,
  syntaxHighlighter: defaultSyntaxHighlighter
};
