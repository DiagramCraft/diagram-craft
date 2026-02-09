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

export const strictParser = {
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

export const extendedParser = {
  flags: {},
  block: [
    new SetextHeaderHandler(),
    new AtxHeaderHandler(),
    new SmallHandler(),
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
