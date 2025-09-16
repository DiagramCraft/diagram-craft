import type { ASTNode } from './types';

/**
 * HTML renderer that converts markdown AST nodes to HTML strings.
 * Handles proper escaping and formatting of HTML output.
 */
export const HTMLRenderer = {
  /**
   * Converts an AST node or array of nodes to HTML string.
   * @param astNode - The AST node(s) to convert
   * @returns HTML string representation
   */
  toHTML(astNode: ASTNode | (ASTNode | string)[] | string): string {
    return HTMLRenderer.toHTMLInner(astNode).trim();
  },

  /**
   * Internal recursive HTML conversion method.
   * @param astNode - AST node, array, or string to convert
   * @returns HTML string
   * @private
   */
  toHTMLInner(astNode: ASTNode | (ASTNode | string)[] | string): string {
    if (Array.isArray(astNode)) {
      const parts: string[] = [];
      let isText = false;

      for (let i = 0; i < astNode.length; i++) {
        const rendered = HTMLRenderer.toHTMLInner(astNode[i]);
        if (i === 0 && !rendered.match(/^<(?!em|a|img|strong|code)/)) {
          isText = true;
        }

        if ((!isText && i !== 0) && !rendered.match(/^<li/) ||
            (rendered.match(/^<[ou]l/) && astNode.length > 1)) {
          parts.push("\n");
        }

        parts.push(rendered);

        if (!isText && i !== (astNode.length - 1)) {
          parts.push("\n");
        }
      }

      return parts.join("");
    }

    if (typeof astNode === 'string') {
      return HTMLRenderer.createHtmlEntities(astNode);
    }

    switch (astNode.type) {
      case "heading":
        return this.makeTag(
          `h${astNode.level}`,
          this.toHTMLInner(astNode.children ?? [])
        );

      case "paragraph":
        return this.makeTag("p", this.toHTMLInner(astNode.children ?? []));

      case "list":
        return this.makeTag(
          astNode.subtype === "ordered" ? "ol" : "ul",
          this.toHTMLInner(astNode.children ?? [])
        );

      case "code":
        if (astNode.inline) {
          return this.makeTag(
            "code",
            this.createHtmlEntities(
              this.toHTMLInner(astNode.children ?? []),
              true
            )
          );
        } else {
          const content = Array.isArray(astNode.children) ? astNode.children[0] : astNode.children;
          return this.makeTag(
            "pre",
            this.makeTag("code", this.createHtmlEntities(content as string, true))
          );
        }

      case "item":
        return this.makeTag("li", this.toHTMLInner(astNode.children ?? []));

      case "line-break":
        return this.makeTag("br");

      case "link":
        if (astNode.href) {
          const attrs: Record<string, string> = { href: astNode.href };
          if (astNode.title) attrs.title = astNode.title;
          return this.makeTag("a", this.toHTMLInner(astNode.children ?? []), attrs);
        } else {
          return astNode.source ?? '';
        }

      case "image":
        if (astNode.href) {
          const attrs: Record<string, string> = {
            src: astNode.href,
            alt: this.toHTMLInner(astNode.children ?? [])
          };
          if (astNode.title) attrs.title = astNode.title;
          return this.makeTag("img", undefined, attrs);
        } else {
          return astNode.source ?? '';
        }

      case "emphasis":
        return this.makeTag("em", this.toHTMLInner(astNode.children ?? []));

      case "strong":
        return this.makeTag("strong", this.toHTMLInner(astNode.children ?? []));

      case "blockquote":
        return this.makeTag("blockquote", this.toHTMLInner(astNode.children ?? []));

      case "html":
        return "\n" + (astNode.html ?? '');

      case "hr":
        return this.makeTag("hr");

      case "link-definition":
        return "";

      default:
        console.log("*** Unsupported type " + astNode.type);
        return "";
    }
  },

  /**
   * Escapes HTML entities in a string to prevent XSS attacks.
   * @param s - String to escape
   * @param escapeAll - If true, escapes all < and > characters
   * @returns Escaped HTML string
   */
  createHtmlEntities(s: string, escapeAll = false): string {
    let result = s.replace(/&(?!#?[a-zA-Z0-9]+;)/g, "&amp;");

    if (!escapeAll) {
      result = result.replace(/<(?!\/?[a-zA-Z]+)/g, "&lt;");
    } else {
      result = result.replace(/</g, "&lt;");
      result = result.replace(/>/g, "&gt;");
    }

    return result;
  },

  /**
   * Creates an HTML tag with optional content and attributes.
   * @param tag - HTML tag name
   * @param content - Optional tag content (undefined for self-closing tags)
   * @param attributes - HTML attributes as key-value pairs
   * @returns Complete HTML tag string
   */
  makeTag(
    tag: string,
    content?: string,
    attributes: Record<string, string> = {}
  ): string {
    let result = "<" + tag;

    if (Object.keys(attributes).length > 0) {
      for (const [key, value] of Object.entries(attributes)) {
        result += ` ${key}="${this.createHtmlEntities(value)}"`;
      }
    }

    if (content === undefined) {
      result += " />";
    } else {
      result += ">";

      if (content.match(/^<(ul|li|blockquote|p|h1|h2|h3|h4|h5|h6)/) && tag !== "pre" && tag !== "li") {
        result += "\n";
      }

      result += content;

      if (content.match(/<\/?(ul|li|blockquote|p|h1|h2|h3|h4|h5|h6)[^>]*>$/) && tag !== "pre" && tag !== "li") {
        result += "\n";
      }

      result += `</${tag}>`;
    }

    return result;
  }
};