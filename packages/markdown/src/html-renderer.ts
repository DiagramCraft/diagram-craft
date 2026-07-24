import type { ASTNode, ASTNodeOfType } from './parser';

/**
 * HTML renderer that converts markdown AST nodes to HTML strings.
 * Handles proper escaping and formatting of HTML output.
 */
export class HTMLRenderer {
  /**
   * Converts an AST node or array of nodes to HTML string.
   * @param astNode - The AST node(s) to convert
   * @returns HTML string representation
   */
  toHTML(astNode: Array<ASTNode>): string {
    return this.processNodeArray(astNode).trim();
  }

  private processNodeArray(astNode: Array<ASTNode>): string {
    const parts: string[] = [];
    let isText = false;

    // Render and filter out empty children first
    const renderedChildren = astNode
      .map(child => this.processNode(child))
      .filter(r => r && r.trim() !== '');

    for (let i = 0; i < renderedChildren.length; i++) {
      const rendered = renderedChildren[i]!;

      if (i === 0 && !rendered.match(/^<(?!em|a|img|strong|del|code)/)) {
        isText = true;
      }

      if (
        (!isText && i !== 0 && !rendered.match(/^<li/)) ||
        (rendered.match(/^<[ou]l/) && renderedChildren.length > 1)
      ) {
        parts.push('\n');
      }

      parts.push(rendered);

      if (!isText && i !== renderedChildren.length - 1) {
        parts.push('\n');
      }
    }

    return parts.join('');
  }

  private processNode(astNode: ASTNode): string {
    switch (astNode.type) {
      case 'component':
        return this.createHtmlEntities(astNode.source, true);

      case 'literal':
        return this.createHtmlEntities(astNode.value);

      case 'heading':
        return this.makeTag(`h${astNode.level}`, this.processNodeArray(astNode.children ?? []));

      case 'paragraph': {
        const paragraphContent = this.processNodeArray(astNode.children ?? []);
        // Skip empty paragraphs
        if (!paragraphContent || paragraphContent.trim() === '') {
          return '';
        }
        // Remove trailing newlines from paragraph content
        return this.makeTag('p', paragraphContent.replace(/\n+$/, ''));
      }
      case 'list':
        return this.makeTag(
          astNode.subtype === 'ordered' ? 'ol' : 'ul',
          this.processNodeArray(astNode.children ?? []),
          astNode.children?.some(
            child => child.type === 'item' && typeof child.checked === 'boolean'
          )
            ? { class: 'task-list' }
            : {}
        );

      case 'code':
        if (astNode.inline) {
          return this.makeTag(
            'code',
            this.createHtmlEntities(this.processNodeArray(astNode.children ?? []), true)
          );
        } else {
          const content = Array.isArray(astNode.children) ? astNode.children[0] : astNode.children;
          return this.makeTag(
            'pre',
            this.makeTag(
              'code',
              this.createHtmlEntities((content as ASTNodeOfType<'literal'>).value, true)
            )
          );
        }

      case 'item': {
        const itemContent = this.processNodeArray(astNode.children ?? []);
        const checkbox =
          typeof astNode.checked === 'boolean'
            ? `<input type="checkbox" disabled${astNode.checked ? ' checked' : ''} />`
            : '';
        // Remove trailing newlines from list item content
        return this.makeTag('li', `${checkbox}${itemContent.replace(/\n+$/, '')}`);
      }

      case 'line-break':
        return this.makeTag('br');

      case 'link':
        if (astNode.href) {
          const attrs: Record<string, string> = { href: astNode.href };
          if (astNode.title) attrs.title = astNode.title;
          return this.makeTag('a', this.processNodeArray(astNode.children ?? []), attrs);
        } else {
          return astNode.source ?? '';
        }

      case 'image':
        if (astNode.href) {
          const attrs: Record<string, string> = {
            src: astNode.href,
            alt: this.processNodeArray(astNode.children ?? [])
          };
          if (astNode.title) attrs.title = astNode.title;
          return this.makeTag('img', undefined, attrs);
        } else {
          return astNode.source ?? '';
        }

      case 'emphasis':
        return this.makeTag('em', this.processNodeArray(astNode.children ?? []));

      case 'strong':
        return this.makeTag('strong', this.processNodeArray(astNode.children ?? []));

      case 'strikethrough':
        return this.makeTag('del', this.processNodeArray(astNode.children ?? []));

      case 'small':
        return this.makeTag('small', this.processNodeArray(astNode.children ?? []));

      case 'blockquote':
        return this.makeTag('blockquote', this.processNodeArray(astNode.children ?? []));

      case 'html':
        return `\n${astNode.html ?? ''}`;

      case 'hr':
        return this.makeTag('hr');

      case 'link-definition':
        return '';

      case 'table': {
        const rows = astNode.children ?? [];
        const headerRows = rows.filter(
          r => r.type === 'table-row' && (r as { header?: boolean }).header
        );
        const bodyRows = rows.filter(
          r => r.type === 'table-row' && !(r as { header?: boolean }).header
        );
        let html = '';
        if (headerRows.length > 0) {
          html += this.makeTag(
            'thead',
            headerRows
              .map(r => this.makeTag('tr', this.processNodeArray(r.children ?? [])))
              .join('')
          );
        }
        if (bodyRows.length > 0) {
          html += this.makeTag(
            'tbody',
            bodyRows.map(r => this.makeTag('tr', this.processNodeArray(r.children ?? []))).join('')
          );
        }
        return this.makeTag('table', html);
      }

      case 'table-row':
        return this.makeTag('tr', this.processNodeArray(astNode.children ?? []));

      case 'table-cell':
        return this.makeTag(
          astNode.header ? 'th' : 'td',
          this.processNodeArray(astNode.children ?? [])
        );

      default:
        // biome-ignore lint/suspicious/noExplicitAny: false positive
        console.log(`*** Unsupported type ${(astNode as any).type}`);
        return '';
    }
  }

  /**
   * Escapes HTML entities in a string to prevent XSS attacks.
   * @param s - String to escape
   * @param escapeAll - If true, escapes all < and > characters
   * @returns Escaped HTML string
   */
  createHtmlEntities(s: string, escapeAll = false): string {
    let result = s.replace(/&(?!#?[a-zA-Z0-9]+;)/g, '&amp;');

    if (!escapeAll) {
      result = result.replace(/<(?!\/?[a-zA-Z]+)/g, '&lt;');
    } else {
      result = result.replace(/</g, '&lt;');
      result = result.replace(/>/g, '&gt;');
    }

    return result;
  }

  /**
   * Creates an HTML tag with optional content and attributes.
   * @param tag - HTML tag name
   * @param content - Optional tag content (undefined for self-closing tags)
   * @param attributes - HTML attributes as key-value pairs
   * @returns Complete HTML tag string
   */
  makeTag(tag: string, content?: string, attributes: Record<string, string> = {}): string {
    let result = `<${tag}`;

    if (Object.keys(attributes).length > 0) {
      for (const [key, value] of Object.entries(attributes)) {
        result += ` ${key}="${this.createHtmlEntities(value)}"`;
      }
    }

    if (content === undefined) {
      result += ' />';
    } else {
      result += '>';

      if (
        content.match(/^<(ul|li|blockquote|p|h1|h2|h3|h4|h5|h6)/) &&
        tag !== 'pre' &&
        tag !== 'li'
      ) {
        result += '\n';
      }

      result += content;

      if (
        content.match(/<\/?(ul|li|blockquote|p|h1|h2|h3|h4|h5|h6)[^>]*>$/) &&
        tag !== 'pre' &&
        tag !== 'li'
      ) {
        result += '\n';
      }

      result += `</${tag}>`;
    }

    return result;
  }
}
