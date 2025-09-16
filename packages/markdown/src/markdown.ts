import type { ParserConfiguration, ParserType, ASTNode } from './types';
import { Parser } from './parser';
import { HTMLRenderer } from './html-renderer';
import {
  ParagraphHandler,
  SetextHeaderHandler,
  AtxHeaderHandler,
  BlockquoteHandler,
  CodeHandler,
  ListHandler,
  InlineCodeHandler,
  InlineEmphasisHandler,
  InlineLinkHandler
} from './handlers';

export class MarkdownEngine {
  private parsers: Record<string, ParserConfiguration> = {};

  constructor() {
    this.registerParser('strict', {
      flags: {},
      block: [
        new SetextHeaderHandler(),
        new AtxHeaderHandler(),
        new BlockquoteHandler(),
        new CodeHandler(),
        new ListHandler()
      ],
      inline: [
        new InlineCodeHandler(),
        new InlineLinkHandler('image'),
        new InlineLinkHandler('link'),
        new InlineEmphasisHandler('*'),
        new InlineEmphasisHandler('_')
      ]
    });
  }

  registerParser(type: string, configuration: ParserConfiguration): void {
    this.parsers[type] = configuration;
  }

  parser(type: ParserType = 'strict', configuration: ParserConfiguration = {}): Parser {
    const mergedConfig = this.buildConfig(type, configuration);

    // Always add paragraph handler last
    mergedConfig.block = mergedConfig.block ?? [];
    mergedConfig.block.push(new ParagraphHandler());

    return new Parser(mergedConfig.block, mergedConfig.inline ?? [], mergedConfig.flags ?? {});
  }

  private buildConfig(type: string, configuration: ParserConfiguration = {}): ParserConfiguration {
    const baseConfig = this.parsers[type];
    if (!baseConfig) {
      throw new Error(`Unknown parser type: ${type}`);
    }

    let config = { ...baseConfig };

    if (baseConfig.parent) {
      const parentConfig = this.buildConfig(baseConfig.parent);
      config = this.mergeConfigurations(parentConfig, config);
    }

    return this.mergeConfigurations(config, configuration);
  }

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

  toHTML(astNode: ASTNode | ASTNode[] | string): string {
    return HTMLRenderer.toHTML(astNode);
  }
}

// Create default instance
const defaultEngine = new MarkdownEngine();

// Export convenience functions
export const parseMarkdown = (markdown: string, type?: ParserType): ASTNode[] => {
  return defaultEngine.parser(type).parse(markdown);
};

export const markdownToHTML = (markdown: string, type?: ParserType): string => {
  const ast = parseMarkdown(markdown, type);
  return defaultEngine.toHTML(ast);
};

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
