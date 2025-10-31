/**
 * HTML parsing and manipulation utilities.
 *
 * @example
 * ```ts
 * import { stripTags, HTMLParser } from '@diagram-craft/utils/html';
 *
 * const cleaned = stripTags('<p>Hello <script>bad</script> World</p>', ['p']);
 * // Returns: '<p>Hello  World</p>'
 * ```
 *
 * @module
 */

/**
 * Removes HTML tags from a string except those in the allowed list.
 *
 * @param input - The HTML string to process
 * @param allowed - Array of tag names to preserve (default: common formatting tags)
 * @returns String with non-allowed tags removed
 *
 * @example
 * ```ts
 * stripTags('<div>Hello <script>alert(1)</script></div>', ['div']);
 * // Returns: '<div>Hello </div>'
 * ```
 */
export const stripTags = (
  input: string,
  allowed: Array<string> = ['br', 'i', 'u', 'b', 'span', 'div', 'font']
) => {
  const tags = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi;
  const comments = /<!--[\s\S]*?-->/gi;
  return input
    .replace(comments, '')
    .replace(tags, ($0, $1) => (allowed.includes($1.toLowerCase()) ? $0 : ''));
};

/**
 * Callback interface for HTML parsing events.
 */
export interface HTMLParserCallback {
  /** Called when text content is encountered */
  onText: (text: string) => void;
  /** Called when an opening tag is encountered */
  onTagOpen: (tag: string, attributes: Record<string, string>) => void;
  /** Called when a closing tag is encountered */
  onTagClose: (tag: string) => void;
  /** Called at the start of parsing */
  onStart: () => void;
  /** Called at the end of parsing */
  onEnd: () => void;
}

/**
 * Simple HTML parser for sanitized HTML content.
 *
 * This is a basic parser designed primarily for parsing clipboard HTML content.
 * It may not handle all edge cases in arbitrary HTML.
 *
 * Note: This is a rather trivial HTML parser. There will be multiple
 * cases in which it will fail to parse the HTML correctly. However,
 * the main purpose of this parser is to parse sanitized HTML coming from
 * the clipboard
 *
 * @example
 * ```ts
 * const parser = new HTMLParser({
 *   onText: (text) => console.log('Text:', text),
 *   onTagOpen: (tag, attrs) => console.log('Open:', tag),
 *   onTagClose: (tag) => console.log('Close:', tag),
 *   onStart: () => console.log('Start'),
 *   onEnd: () => console.log('End')
 * });
 * parser.parse('<p>Hello</p>');
 * ```
 */
export class HTMLParser {
  private tagStart = /<([a-z][a-z0-9]*)\b[^>]*>/i;
  private selfClosingTags =
    'br,img,input,meta,link,hr,area,base,col,command,embed,keygen,param,source,track,wbr'.split(
      ','
    );

  /**
   * Creates a new HTML parser instance.
   *
   * @param handler - Callback handler for parsing events
   */
  constructor(private readonly handler: HTMLParserCallback) {
    this.handler.onStart();
  }

  /**
   * Parses an HTML string and invokes callbacks for each element encountered.
   *
   * @param s - The HTML string to parse
   */
  parse(s: string) {
    let html = s;

    while (html.length > 0) {
      if (html.indexOf('<!--') === 0) {
        const end = html.indexOf('-->');
        if (end === -1) break;

        html = html.slice(end + 3);
      } else if (html.indexOf('</') === 0) {
        const tag = html.substring(2, html.indexOf('>'));
        this.handler.onTagClose(tag);

        html = html.slice(html.indexOf('>') + 1);
      } else if (html.indexOf('<') === 0) {
        const match = html.match(this.tagStart);
        if (!match) break;

        const tag = match[1]!;
        const end = html.indexOf('>');
        if (end === -1) break;

        const attributes = this.parseAttributes(html.slice(match[1]!.length + 1, end));
        this.handler.onTagOpen(tag, attributes);

        if (this.selfClosingTags.includes(tag)) {
          this.handler.onTagClose(tag);
        }

        html = html.slice(end + 1);
      } else {
        const end = html.indexOf('<');
        if (end === -1) {
          this.handler.onText(html);
          html = '';
          break;
        }

        this.handler.onText(html.slice(0, end));
        html = html.slice(end);
      }
    }

    this.handler.onEnd();
  }

  private parseAttributes(s: string) {
    const attributes: Record<string, string> = {};
    const attr = /([a-z][a-z0-9]*)="([^"]*)"/gi;
    let match: RegExpExecArray | null;

    while ((match = attr.exec(s))) {
      attributes[match[1]!] = match[2]!;
    }

    return attributes;
  }
}
