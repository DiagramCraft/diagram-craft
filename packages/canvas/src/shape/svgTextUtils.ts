import { assert } from '@diagram-craft/utils/assert';
import { HTMLParserCallback } from '@diagram-craft/utils/html';

const getNumericStyleProp = (style: CSSStyleDeclaration, prop: string) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return parseInt((style[prop as any] ?? '0px').replace('px', ''), 10);
};

const getNumericAttr = (el: Element, attr: string) => {
  return parseFloat(el.getAttribute(attr) ?? '0');
};

const getTextNodesInEl = (el: Node) => {
  const childNodes: Array<Node> = [...el.childNodes];
  return childNodes.reduce((acc, node): Array<Node> => {
    return node.nodeType === 3
      ? acc.concat(node)
      : node.childNodes.length
        ? acc.concat(getTextNodesInEl(node))
        : acc;
  }, [] as Array<Node>);
};

const stylesToNotCopy = {
  'min-inline-size': '0px',
  'min-width': '0px',
  'padding-block': '0px',
  'padding-block-end': '0px',
  'padding-block-start': '0px',
  'padding-inline': '0px',
  'padding-inline-start': '0px',
  'padding-inline-end': '0px',
  'padding': '0px',
  'padding-top': '0px',
  'padding-bottom': '0px',
  'padding-right': '0px',
  'padding-left': '0px',
  'perspective-origin': '0px 0px'
};

const copyStyle = (
  style: CSSStyleDeclaration,
  target: HTMLElement | SVGElement,
  element: Element
) => {
  const elementStyle = getComputedStyle(element);

  for (const prop of style) {
    if (
      // @ts-ignore
      style[prop] !== elementStyle[prop] &&
      // @ts-ignore
      prop !== 'display' &&
      // @ts-ignore
      style[prop] !== stylesToNotCopy[prop]
    ) {
      // @ts-ignore
      target.style[prop] = style[prop];
    }
  }
};

const createTSpan = () => document.createElementNS('http://www.w3.org/2000/svg', 'tspan');

type InlineElement = {
  with: number;
  ascent: number;
  descent: number;
  gap: number;
  style: CSSStyleDeclaration;
  text: string;
  keepWithPrevious: boolean;
  space: boolean;
};

type BlockElement = {
  width: number;
  ascent: number;
  descent: number;
  children: InlineElement[];
};

export class SvgTextHelper {
  private leading: number;
  private ascent: number;
  private x: number;
  private y: number;
  private width: number;
  private height: number;

  private static canvas: HTMLCanvasElement;

  constructor(private readonly element: SVGTextElement) {
    SvgTextHelper.canvas ??= document.createElement('canvas');

    const elementParentNode = this.element.parentNode as SVGGraphicsElement | undefined;
    assert.present(elementParentNode);

    const style = getComputedStyle(this.element);

    const lineHeight = style.lineHeight;
    if (lineHeight === 'normal') {
      const fontSize = getNumericStyleProp(style, 'fontSize');
      // TODO: This is font dependent
      this.leading = 1.15 * fontSize;
    } else {
      this.leading = parseFloat(lineHeight);
    }

    // TODO: This is font dependent
    this.ascent = 0.8 * this.leading;

    this.x =
      getNumericAttr(this.element, 'x') +
      getNumericStyleProp(style, 'margin-left') +
      getNumericStyleProp(style, 'padding-left');
    this.y =
      getNumericAttr(this.element, 'y') +
      getNumericStyleProp(style, 'margin-top') +
      getNumericStyleProp(style, 'padding-top');

    this.width =
      (this.element.dataset.width
        ? Number.parseInt(this.element.dataset.width, 10)
        : elementParentNode.getBBox().width - this.x) -
      (getNumericStyleProp(style, 'margin-left') +
        getNumericStyleProp(style, 'margin-right') +
        getNumericStyleProp(style, 'padding-left') +
        getNumericStyleProp(style, 'padding-right'));

    this.height =
      (this.element.dataset.height
        ? Number.parseInt(this.element.dataset.height, 10)
        : elementParentNode.getBBox().height - this.x) -
      (getNumericStyleProp(style, 'margin-top') +
        getNumericStyleProp(style, 'margin-bottom') +
        getNumericStyleProp(style, 'padding-top') +
        getNumericStyleProp(style, 'padding-bottom'));
  }

  private trimBlockElement(blockElement: BlockElement) {
    if (blockElement.children.every(be => be.space)) return;

    // Trim leading space
    while (blockElement.children.length > 0 && blockElement.children[0]!.space) {
      blockElement.children.shift();
    }

    // Trim trailing space
    while (
      blockElement.children.length > 0 &&
      blockElement.children[blockElement.children.length - 1]!.space
    ) {
      blockElement.children.pop();
    }
  }

  reflow(debug = false) {
    const blockElements: BlockElement[] = [];

    // Phase 1 - Create initial set of block elements

    const children = this.element.childNodes;
    for (const line of children) {
      if (!(line instanceof SVGTSpanElement)) continue;

      const blockElement: BlockElement = { width: 0, ascent: 0, descent: 0, children: [] };
      blockElements.push(blockElement);

      const textNodes = getTextNodesInEl(line);
      for (let i = 0; i < textNodes.length; i++) {
        const textNode = textNodes[i]!;

        const style = getComputedStyle(textNode.parentElement!);

        const words = (textNode.nodeValue ?? '').split(/(\s)/);
        for (let j = 0; j < words.length; j++) {
          const word = words[j]!;
          if (word === '') continue;

          blockElement.children.push({
            with: 0,
            ascent: 0,
            descent: 0,
            gap: 0,
            style: style,
            text: word,
            space: word.trim() === '',

            // First word in a new inline element should keep to the previous
            keepWithPrevious: i > 0 && j === 0
          });
        }
      }

      this.trimBlockElement(blockElement);
    }

    // Phase 2 - Measure each inline element

    const context = SvgTextHelper.canvas.getContext('2d')!;

    for (const blockElement of blockElements) {
      for (const inlineElement of blockElement.children) {
        context.font =
          (inlineElement.style.fontStyle === 'italic' ? 'italic ' : '') +
          inlineElement.style.fontWeight +
          ' ' +
          inlineElement.style.fontSize +
          ' ' +
          inlineElement.style.fontFamily;
        context.textAlign = 'left';
        context.fillStyle = 'black';
        context.textBaseline = 'middle';
        // TODO: Handle text style (bold, underline, italic - and combinations thereof) as well

        const metrics = context.measureText(inlineElement.text);
        inlineElement.with = metrics.width;

        // TODO: This we could cache
        const maxMetrics = context.measureText('ÄfgMijlvy');
        inlineElement.ascent = maxMetrics.actualBoundingBoxAscent;
        inlineElement.descent = maxMetrics.actualBoundingBoxDescent;

        // TODO: Fix gap calculation
      }
    }

    // Phase 3 - Reflow

    const reflowedBlockElements: BlockElement[] = [];

    for (const blockElement of blockElements) {
      let target: BlockElement = { ...blockElement, children: [] };
      for (let i = 0; i < blockElement.children.length; i++) {
        const inlineElement = blockElement.children[i]!;

        const elementSet: InlineElement[] = [inlineElement];
        let elementWidth = inlineElement.with;
        while (
          i < blockElement.children.length - 1 &&
          blockElement.children[i + 1]!.keepWithPrevious
        ) {
          i++;
          elementWidth += blockElement.children[i]!.with;
          elementSet.push(blockElement.children[i]!);
        }

        // Make new line if needed
        if (target.width + elementWidth >= this.width && target.children.length > 0) {
          reflowedBlockElements.push(target);
          target = { ...blockElement, children: [] };
        }

        target.children.push(...elementSet);
        target.width += elementWidth;
        target.ascent = Math.max(
          target.ascent,
          elementSet.reduce((acc, e) => Math.max(acc, e.ascent), 0)
        );
        target.descent = Math.max(
          target.descent,
          elementSet.reduce((acc, e) => Math.max(acc, e.descent), 0)
        );
      }
      reflowedBlockElements.push(target);
    }

    for (const blockElement of reflowedBlockElements) {
      this.trimBlockElement(blockElement);
    }

    // Phase 4 - create DOM elements

    let lastLineHeight = 0;
    const domElements: SVGTSpanElement[] = [];
    for (let i = 0; i < reflowedBlockElements.length; i++) {
      const blockElement = reflowedBlockElements[i]!;

      const line = createTSpan();
      line.setAttribute('x', this.x.toString());
      line.setAttribute(
        'dy',
        (lastLineHeight === 0 ? 0 : lastLineHeight + blockElement.ascent + 0.2).toString()
      );
      domElements.push(line);

      lastLineHeight = blockElement.ascent === 0 ? lastLineHeight : blockElement.descent;

      for (const inlineElement of blockElement.children) {
        const styledSpan = createTSpan();
        styledSpan.innerHTML = inlineElement.text;
        copyStyle(inlineElement.style, styledSpan, this.element);
        line.appendChild(styledSpan);
      }
    }

    if (debug) {
      console.log('available width', this.element.dataset.width, this.width);
      console.log(this.element.innerHTML);
      console.dir(
        JSON.stringify(
          blockElements,
          (key: string, value: unknown) => (key === 'style' ? '[STYLE]' : value),
          '  '
        )
      );
      console.dir(
        JSON.stringify(
          reflowedBlockElements,
          (key: string, value: unknown) => (key === 'style' ? '[STYLE]' : value),
          '  '
        )
      );
    }

    // Phase 5 - apply to DOM

    this.element.innerHTML = '';
    const fragment = document.createDocumentFragment();
    for (const line of domElements) {
      fragment.appendChild(line);
    }
    this.element.appendChild(fragment);
  }

  realign(align: 'center' | 'left' | 'right', vAlign: 'top' | 'middle' | 'bottom') {
    const lines: SVGTSpanElement[] = [];

    // Add all element children to lines
    const children = this.element.childNodes;
    for (const child of children) {
      if (child instanceof SVGTSpanElement) {
        lines.push(child);
        child.x.baseVal[0]!.value = this.x;
      }
    }

    // Align text
    for (const line of lines) {
      if (align === 'center') {
        const metrics = line.getBBox();
        line.setAttribute('x', (this.x + (this.width - metrics.width) / 2).toString());
      } else if (align === 'right') {
        const metrics = line.getBBox();
        line.setAttribute('x', (this.x + this.width - metrics.width).toString());
      } else {
        line.setAttribute('x', this.x.toString());
      }
    }

    // Vertical align
    const totalHeight = lines.reduce((acc, line) => {
      return acc + line.getBBox().height;
    }, 0);
    if (vAlign === 'middle') {
      lines[0]!.setAttribute(
        'y',
        (this.y + (this.height - totalHeight) / 2 + this.ascent).toString()
      );
    } else if (vAlign === 'bottom') {
      lines[0]!.setAttribute('y', (this.y + (this.height - totalHeight) + this.ascent).toString());
    } else {
      lines[0]!.setAttribute('y', (this.y + this.ascent).toString());
    }
  }

  apply() {}
}

export class HTMLToSvgTransformer implements HTMLParserCallback {
  svgTags: string = '';
  private currentLine: string = '';
  private tagStack: Array<{
    tag: string;
    style: string;
  }> = [];

  constructor() {}

  private newLine() {
    this.svgTags += `<tspan class="line">${this.currentLine}</tspan>`;
    for (let i = 0; i < this.tagStack.length; i++) {
      this.svgTags += '</tspan>';
    }
    this.svgTags += '\n';

    this.currentLine = '';

    if (this.tagStack.length > 0) {
      for (let i = 0; i < this.tagStack.length; i++) {
        const e = this.tagStack[i]!;
        this.currentLine += `<tspan data-tag="${e.tag}" style="${e.style}">`;
      }
    }
  }

  onText(text: string) {
    this.currentLine += text;
  }

  onTagOpen(tag: string, attributes: Record<string, string>) {
    if (tag === 'br') {
      this.newLine();
      return;
    }

    let style = '';

    if (tag === 'u') {
      style += 'text-decoration: underline;';
    }
    if (tag === 'b') {
      style += 'font-weight: bold;';
    }
    if (tag === 'i') {
      style += 'font-style: italic;';
    }
    if (tag === 'font') {
      if (attributes.color) {
        style += `fill: ${attributes.color};`;
      }
      if (attributes['style']) {
        style += attributes['style'];
      }
    }

    this.tagStack.push({ tag, style });

    this.currentLine += `<tspan data-tag="${tag}" style="${style}">`;
  }

  onTagClose(tag: string) {
    if (tag !== 'br') {
      this.currentLine += `</tspan>` + (tag === 'div' || tag === 'p' ? ' ' : '');
      this.tagStack.pop();
    }

    if (tag === 'div' || tag === 'p') {
      this.newLine();
    }
  }

  onStart() {}

  onEnd() {
    this.newLine();
  }
}
