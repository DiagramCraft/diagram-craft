/**
 * HTML to Markdown converter that processes HTML DOM structures and converts them to markdown.
 * Supports common HTML elements like headings, paragraphs, lists, emphasis, links, images, and code.
 */
export class HTMLToMarkdownConverter {
  private options: HTMLToMarkdownOptions;

  constructor(options: Partial<HTMLToMarkdownOptions> = {}) {
    this.options = {
      bulletListMarker: '-',
      codeBlockStyle: 'fenced',
      emphasisDelimiter: '*',
      strongDelimiter: '**',
      linkStyle: 'inline',
      headingStyle: 'atx',
      ...options
    };
  }

  /**
   * Converts an HTML DOM element to markdown string.
   * @param element - The HTML element to convert
   * @returns Markdown string representation
   */
  convert(element: Element): string {
    return this.processElement(element).trim();
  }

  /**
   * Converts an HTML string to markdown.
   * @param html - The HTML string to convert
   * @returns Markdown string representation
   */
  convertHTML(html: string): string {
    if (typeof document !== 'undefined') {
      const div = document.createElement('div');
      div.innerHTML = html;
      return this.convert(div);
    } else {
      throw new Error('HTML string conversion requires a DOM environment');
    }
  }

  private processElement(element: Element | Node): string {
    if (element.nodeType === Node.TEXT_NODE) {
      return this.escapeMarkdown((element as Text).textContent ?? '');
    }

    if (element.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }

    const el = element as Element;
    const tagName = el.tagName.toLowerCase();

    switch (tagName) {
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6':
        return this.convertHeading(el, parseInt(tagName[1]!, 10));
      case 'p':
        return this.convertParagraph(el);
      case 'strong':
      case 'b':
        return this.convertStrong(el);
      case 'em':
      case 'i':
        return this.convertEmphasis(el);
      case 'a':
        return this.convertLink(el);
      case 'img':
        return this.convertImage(el);
      case 'code':
        return this.convertInlineCode(el);
      case 'pre':
        return this.convertCodeBlock(el);
      case 'blockquote':
        return this.convertBlockquote(el);
      case 'ul':
        return this.convertUnorderedList(el);
      case 'ol':
        return this.convertOrderedList(el);
      case 'li':
        return this.convertListItem(el);
      case 'br':
        return '\n';
      case 'hr':
        return '\n---\n\n';
      case 'div':
      case 'span':
      case 'section':
      case 'article':
        return this.processChildren(el);
      default:
        return this.processChildren(el);
    }
  }

  private processChildren(element: Element): string {
    const children = Array.from(element.childNodes);
    return children.map(child => this.processElement(child)).join('');
  }

  private convertHeading(element: Element, level: number): string {
    const content = this.processChildren(element).trim();
    if (this.options.headingStyle === 'atx') {
      return '\n' + '#'.repeat(level) + ' ' + content + '\n\n';
    } else {
      const underline = level === 1 ? '=' : '-';
      return '\n' + content + '\n' + underline.repeat(content.length) + '\n\n';
    }
  }

  private convertParagraph(element: Element): string {
    const content = this.processChildren(element).trim();
    return content ? content + '\n\n' : '';
  }

  private convertStrong(element: Element): string {
    const content = this.processChildren(element);
    return this.options.strongDelimiter + content + this.options.strongDelimiter;
  }

  private convertEmphasis(element: Element): string {
    const content = this.processChildren(element);
    return this.options.emphasisDelimiter + content + this.options.emphasisDelimiter;
  }

  private convertLink(element: Element): string {
    const href = element.getAttribute('href') ?? '';
    const title = element.getAttribute('title');
    const content = this.processChildren(element);

    if (this.options.linkStyle === 'inline') {
      const titlePart = title ? ` "${title}"` : '';
      return `[${content}](${href}${titlePart})`;
    } else {
      return `[${content}][${href}]`;
    }
  }

  private convertImage(element: Element): string {
    const src = element.getAttribute('src') ?? '';
    const alt = element.getAttribute('alt') ?? '';
    const title = element.getAttribute('title');
    const titlePart = title ? ` "${title}"` : '';
    return `![${alt}](${src}${titlePart})`;
  }

  private convertInlineCode(element: Element): string {
    const content = this.processChildren(element);
    return '`' + content + '`';
  }

  private convertCodeBlock(element: Element): string {
    const codeElement = element.querySelector('code');
    const content = codeElement ? (codeElement.textContent ?? '') : (element.textContent ?? '');
    const language = codeElement?.getAttribute('class')?.replace('language-', '') ?? '';

    if (this.options.codeBlockStyle === 'fenced') {
      return '\n```' + language + '\n' + content + '\n```\n\n';
    } else {
      const indentedContent = content
        .split('\n')
        .map(line => '    ' + line)
        .join('\n');
      return indentedContent + '\n\n';
    }
  }

  private convertBlockquote(element: Element): string {
    const content = this.processChildren(element).trim();
    const lines = content.split('\n');
    const quotedLines = lines.map(line => '> ' + line);
    return '\n' + quotedLines.join('\n') + '\n\n';
  }

  private convertUnorderedList(element: Element): string {
    const content = this.processChildren(element);
    return '\n' + content;
  }

  private convertOrderedList(element: Element): string {
    const content = this.processChildren(element);
    return '\n' + content;
  }

  private convertListItem(element: Element): string {
    const content = this.processChildren(element).trim();
    const parent = element.parentElement;

    if (parent?.tagName.toLowerCase() === 'ol') {
      const index = Array.from(parent.children).indexOf(element) + 1;
      return `${index}. ${content}\n`;
    } else {
      return `${this.options.bulletListMarker} ${content}\n`;
    }
  }

  private escapeMarkdown(text: string): string {
    return text.replace(/([\\`*_{}[\]()#+-.!])/g, '\\$1');
  }
}

/**
 * Configuration options for HTML to Markdown conversion.
 */
export type HTMLToMarkdownOptions = {
  bulletListMarker: '-' | '*' | '+';
  codeBlockStyle: 'fenced' | 'indented';
  emphasisDelimiter: '*' | '_';
  strongDelimiter: '**' | '__';
  linkStyle: 'inline' | 'reference';
  headingStyle: 'atx' | 'setext';
};

/**
 * Converts an HTML DOM element to markdown string using default options.
 * @param element - The HTML element to convert
 * @param options - Optional configuration for the conversion
 * @returns Markdown string representation
 */
export const htmlToMarkdown = (
  element: Element,
  options?: Partial<HTMLToMarkdownOptions>
): string => {
  const converter = new HTMLToMarkdownConverter(options);
  return converter.convert(element);
};

/**
 * Converts an HTML string to markdown using default options.
 * @param html - The HTML string to convert
 * @param options - Optional configuration for the conversion
 * @returns Markdown string representation
 */
export const htmlStringToMarkdown = (
  html: string,
  options?: Partial<HTMLToMarkdownOptions>
): string => {
  const converter = new HTMLToMarkdownConverter(options);
  return converter.convertHTML(html);
};
