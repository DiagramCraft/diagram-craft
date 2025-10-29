import { defaultFormat } from './formats/default';
import type { DiagramFormat } from './types';

/**
 * Global registry for diagram text formats
 */
export const FormatRegistry: Record<string, DiagramFormat> & {
  default: DiagramFormat;
} = { default: defaultFormat };
