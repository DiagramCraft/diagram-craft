import type { ASTNode, ParserConfiguration, ParserType } from './parser';
import { Parser } from './parser';
import { HTMLRenderer } from './html-renderer';
import { ParagraphHandler } from './handlers';
import { strictParser, extendedParser } from './strict-parser';
import { HTMLToMarkdownConverter, htmlToMarkdown, htmlStringToMarkdown } from './html-to-markdown';
import type { HTMLToMarkdownOptions } from './html-to-markdown';

/**
 * Main markdown parsing engine that manages parser configurations and provides
 * high-level parsing functionality.
 */
export class MarkdownEngine {
  private parsers: Record<string, ParserConfiguration> = {};

  /**
   * Creates a new MarkdownEngine instance with default 'strict' parser configuration.
   * The strict parser includes handlers for headers, blockquotes, code blocks, lists,
   * and various inline elements like emphasis, links, and inline code.
   */
  constructor() {
    this.registerParser('strict', strictParser);
    this.registerParser('extended', extendedParser);
  }

  /**
   * Registers a new parser configuration with the given type name.
   * @param type - The name/type identifier for this parser configuration
   * @param configuration - The parser configuration including block/inline handlers and flags
   */
  registerParser(type: string, configuration: ParserConfiguration): void {
    this.parsers[type] = configuration;
  }

  /**
   * Creates a new parser instance with the specified configuration.
   * Merges the base configuration with any overrides and ensures paragraph handler is last.
   * @param type - The parser type to use (defaults to 'strict')
   * @param configuration - Additional configuration to merge with the base
   * @returns A configured Parser instance ready for parsing
   */
  parser(type: ParserType = 'strict', configuration: ParserConfiguration = {}): Parser {
    const mergedConfig = this.buildConfig(type, configuration);

    // Always add paragraph handler last
    mergedConfig.block ??= [];
    mergedConfig.block.push(new ParagraphHandler());

    return new Parser(mergedConfig.block, mergedConfig.inline ?? [], mergedConfig.flags ?? {});
  }

  /**
   * Builds a complete parser configuration by merging base config with overrides.
   * Handles inheritance through the 'parent' property in configurations.
   * @param type - The parser type to build configuration for
   * @param configuration - Additional configuration overrides
   * @returns Merged parser configuration
   * @private
   */
  private buildConfig(type: string, configuration: ParserConfiguration = {}): ParserConfiguration {
    const baseConfig = this.parsers[type];
    if (!baseConfig) throw new Error(`Unknown parser type: ${type}`);

    let config = { ...baseConfig };

    if (baseConfig.parent) {
      const parentConfig = this.buildConfig(baseConfig.parent);
      config = this.mergeConfigurations(parentConfig, config);
    }

    return this.mergeConfigurations(config, configuration);
  }

  /**
   * Merges two parser configurations, concatenating arrays and merging objects.
   * @param base - The base configuration
   * @param override - The configuration to merge on top
   * @returns Merged configuration
   * @private
   */
  private mergeConfigurations(
    base: ParserConfiguration,
    override: ParserConfiguration
  ): ParserConfiguration {
    const result: ParserConfiguration = {};

    if (base.inline || override.inline) {
      result.inline = [...(base.inline ?? []), ...(override.inline ?? [])];
    }

    if (base.block || override.block) {
      result.block = [...(base.block ?? []), ...(override.block ?? [])];
    }

    if (base.flags || override.flags) {
      result.flags = { ...base.flags, ...override.flags };
    }

    return result;
  }

  /**
   * Converts an AST node or array of nodes to HTML string.
   * @param astNode - The AST node(s) to convert
   * @returns HTML string representation
   */
  toHTML(astNode: ASTNode[]): string {
    return new HTMLRenderer().toHTML(astNode);
  }
}

// Create default instance
const defaultEngine = new MarkdownEngine();

/**
 * Parses markdown text into an Abstract Syntax Tree (AST).
 * @param markdown - The markdown text to parse
 * @param type - The parser type to use (defaults to 'strict')
 * @returns Array of AST nodes representing the parsed markdown
 */
export const parseMarkdown = (markdown: string, type?: ParserType): ASTNode[] => {
  return defaultEngine.parser(type).parse(markdown);
};

/**
 * Converts markdown text directly to HTML string.
 * @param markdown - The markdown text to convert
 * @param type - The parser type to use (defaults to 'strict')
 * @returns HTML string representation of the markdown
 */
export const markdownToHTML = (markdown: string, type?: ParserType): string => {
  const ast = parseMarkdown(markdown, type);
  return defaultEngine.toHTML(ast);
};

/**
 * Strips markdown syntax and returns plain text.
 * Uses simple regex replacements to remove common markdown formatting.
 * @param markdown - The markdown text to convert
 * @returns Plain text with markdown syntax removed
 */
export const markdownToPlainText = (markdown: string): string => {
  let text = markdown;

  // Remove markdown syntax
  text = text.replace(/^#{1,6}\s+/gm, ''); // Headers
  text = text.replace(/\*\*(.*?)\*\*/g, '$1'); // Bold
  text = text.replace(/\*(.*?)\*/g, '$1'); // Italic
  text = text.replace(/```[\s\S]*?```/g, ''); // Code blocks
  text = text.replace(/`(.*?)`/g, '$1'); // Inline code
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // Links
  text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1'); // Images

  return text.trim();
};

// Export HTML to Markdown functionality
export { HTMLToMarkdownConverter, htmlToMarkdown, htmlStringToMarkdown };
export type { HTMLToMarkdownOptions };
