import {
  AtxHeaderHandler,
  BlockquoteHandler,
  CodeHandler,
  CommentHandler,
  FencedCodeHandler,
  HorizontalRulerHandler,
  HtmlHandler,
  InlineAutolinksHandler,
  InlineCodeHandler,
  InlineEmphasisHandler,
  InlineLineBreakHandler,
  InlineLinkHandler,
  InlineRefImageAndLinkHandler,
  ListHandler,
  ReferenceLinkDefinitionHandler,
  SetextHeaderHandler,
  SmallHandler
} from './handlers';
import { InlineStrikethroughHandler, TableHandler } from './gfm-handlers';
import type { ParserConfiguration } from './parser';

export const commonmarkPreset: ParserConfiguration = {
  flags: {},
  block: [
    new SetextHeaderHandler(),
    new AtxHeaderHandler(),
    new BlockquoteHandler(),
    new FencedCodeHandler(),
    new CodeHandler(),
    new ListHandler(),
    new HorizontalRulerHandler(),
    new ReferenceLinkDefinitionHandler(),
    new HtmlHandler(),
    new CommentHandler()
  ],
  inline: [
    new InlineCodeHandler(),
    new InlineLinkHandler('image'),
    new InlineRefImageAndLinkHandler('image'),
    new InlineLinkHandler('link'),
    new InlineRefImageAndLinkHandler('link'),
    new InlineAutolinksHandler(),
    new InlineEmphasisHandler('*'),
    new InlineEmphasisHandler('*'),
    new InlineEmphasisHandler('_'),
    new InlineEmphasisHandler('_'),
    new InlineLineBreakHandler()
  ]
};

// GFM extends CommonMark with table support
export const gfmPreset: ParserConfiguration = {
  parent: 'commonmark',
  block: [new TableHandler()],
  inline: [new InlineStrikethroughHandler()]
};

// Extended adds custom extensions on top of GFM
export const extendedPreset: ParserConfiguration = {
  parent: 'gfm',
  block: [new SmallHandler()]
};
