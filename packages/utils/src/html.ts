// TODO: Need to properly test this
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

export interface HTMLParserCallback {
  onText: (text: string) => void;
  onTagOpen: (tag: string, attributes: Record<string, string>) => void;
  onTagClose: (tag: string) => void;
  onStart: () => void;
  onEnd: () => void;
}

// Note: This is a rather trivial HTML parser. There will be multiple
// cases in which it will fail to parse the HTML correctly. However,
// the main purpose of this parser is to parse sanitized HTML coming from
// the clipboard
export class HTMLParser {
  private tagStart = /<([a-z][a-z0-9]*)\b[^>]*>/i;
  private selfClosingTags =
    'br,img,input,meta,link,hr,area,base,col,command,embed,keygen,param,source,track,wbr'.split(
      ','
    );

  constructor(private readonly handler: HTMLParserCallback) {
    this.handler.onStart();
  }

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
