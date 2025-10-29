import type { RegularLayer } from '@diagram-craft/model/diagramLayerRegular';

/**
 * Interface for parsing text into diagram elements
 */
export interface DiagramParser {
  /**
   * Parse text into a list of parsed elements with error reporting
   * @param text - The diagram text to parse
   * @returns Object containing parsed elements and any parsing errors indexed by line number
   */
  parse(text: string): { elements: ParsedElement[]; errors: ParseErrors };
}

/**
 * Interface for serializing diagram elements to text
 */
export interface DiagramSerializer {
  /**
   * Convert diagram layer to text representation
   * @param layer - The layer to serialize
   * @returns Array of text lines representing the diagram
   */
  serialize(layer: RegularLayer): string[];
}

/**
 * Interface for syntax highlighting
 */
export interface SyntaxHighlighter {
  /**
   * Apply syntax highlighting to lines of text
   * @param lines - Lines of text to highlight
   * @param errors - Parse errors indexed by line number
   * @returns Array of HTML strings with syntax highlighting
   */
  highlight(lines: string[], errors: ParseErrors): string[];
}

/**
 * Complete diagram format definition
 */
export interface DiagramFormat {
  /** Unique identifier for this format */
  id: string;

  /** Human-readable name */
  name: string;

  /** Optional description */
  description?: string;

  /** Parser implementation */
  parser: DiagramParser;

  /** Serializer implementation */
  serializer: DiagramSerializer;

  /** Optional syntax highlighter */
  syntaxHighlighter?: SyntaxHighlighter;
}

/**
 * Parsed element from diagram text
 * This is a format-agnostic intermediate representation
 */
export type ParsedElement = {
  id: string;
  line: number; // Line number where this element is defined
  props?: Partial<NodeProps | EdgeProps>;
  metadata?: Partial<ElementMetadata>;
  stylesheet?: string;
  children?: ParsedElement[];
} & (
  | {
      type: 'edge';
      from?: string;
      to?: string;
      label?: string;
    }
  | {
      type: 'node';
      shape: string;
      name?: string;
      textStylesheet?: string;
    }
);

/**
 * Parse errors indexed by line number
 */
export type ParseErrors = Map<number, string>;
