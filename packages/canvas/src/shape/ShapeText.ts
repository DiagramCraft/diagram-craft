import { Component } from '../component/component';
import * as svg from '../component/vdom-svg';
import * as html from '../component/vdom-html';
import { rawHTML, VNode } from '../component/vdom';
import { Extent } from '@diagram-craft/geometry/extent';
import { Box } from '@diagram-craft/geometry/box';
import { DeepReadonly } from '@diagram-craft/utils/types';
import { hasBlockElements, HTMLParser, stripTags } from '@diagram-craft/utils/html';
import { hash64 } from '@diagram-craft/utils/hash';
import { applyTemplate } from '@diagram-craft/utils/template';
import { HTMLToSvgTransformer, SvgTextHelper } from './svgTextUtils';
import type { NodeProps } from '@diagram-craft/model/diagramProps';
import type { FlatObject } from '@diagram-craft/utils/flatObject';
import { Angle } from '@diagram-craft/geometry/angle';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { ShapeNodeDefinition, TextHandler } from '@diagram-craft/canvas/shape/shapeNodeDefinition';

const VALIGN_TO_FLEX_JUSTIFY = {
  top: 'flex-start',
  middle: 'center',
  bottom: 'flex-end'
};

const withPx = (n?: number) => (n ? `${n}px` : undefined);

export type ShapeTextProps = {
  id: string;
  node: DiagramNode;
  metadata: DeepReadonly<FlatObject> | undefined;
  textProps: NodeProps['text'];
  text: string;
  bounds: Box;
  onMouseDown: (e: MouseEvent) => void;
  onChange: (text: string) => void;
  onSizeChange?: (size: Extent) => void;
  isSingleSelected: boolean;
};

const getTextElement = (textId: string) => {
  return document.getElementById(textId)?.getElementsByClassName('svg-node__text').item(0) as
    | HTMLDivElement
    | undefined
    | null;
};

const requiresForeignObject = (s: string) => {
  return s.includes('<table') || s.includes('<hr');
};

const storedToEdit = (handler: TextHandler | undefined, s: string) => {
  return handler ? handler.storedToEdit(s) : s;
};

const editToStored = (handler: TextHandler | undefined, s: string) => {
  return (handler ? handler.editToStored(s) : s) ?? '';
};

const storedToHTML = (
  handler: TextHandler | undefined,
  s: string,
  metadata: DeepReadonly<FlatObject>
) => {
  const html = handler ? handler.storedToHTML(s) : s;
  return stripOuterPTags(applyTemplate(html, metadata, !hasBlockElements(html)));
};

export class ShapeText extends Component<ShapeTextProps> {
  private width: number = 0;
  private height: number = 0;

  static edit(textId: string, element: DiagramNode) {
    const elementId = element.id;
    const domId = `text_${textId}_${elementId}`;

    const editable = getTextElement(domId);
    if (!editable) {
      console.warn('editable not found');
      return;
    }

    const def = element.getDefinition() as ShapeNodeDefinition;
    const textHandlers = def.getTextHandler(element);

    editable.innerHTML = storedToEdit(
      textHandlers.inline,
      element.texts[textId === '1' ? 'text' : textId] ?? ''
    );

    editable.contentEditable = textHandlers.inline ? 'plaintext-only' : 'true';
    editable.style.pointerEvents = 'auto';
    editable.onmousedown = (e: MouseEvent) => {
      if (editable.contentEditable === 'true') {
        e.stopPropagation();
      }
    };
    editable.focus();

    setTimeout(() => {
      document.execCommand('selectAll', false, undefined);
    }, 0);
  }

  render(props: ShapeTextProps) {
    const textProps = props.textProps ?? {};

    const color =
      textProps.color === 'stroke' ? props.node.renderProps.stroke.color : textProps.color;

    const style = {
      'color': color ?? 'unset',
      'fill': textProps.color ?? 'unset',

      'font-family': textProps.font ?? 'unset',
      'font-size': withPx(textProps.fontSize) ?? 'unset',
      'font-weight': textProps.bold ? 'bold' : 'normal',
      'font-style': textProps.italic ? 'italic' : 'normal',
      'line-height': `${1.2 * (textProps.lineHeight ?? 1) * 100}%`,
      'min-width': 'min-content',
      'text-decoration': textProps.textDecoration
        ? `${textProps.textDecoration} ${textProps.color ?? 'black'}`
        : 'none',
      'text-transform': textProps.textTransform ?? 'none',
      'text-align': textProps.align ?? 'unset',
      'padding-left': withPx(textProps.left) ?? '0',
      'padding-right': withPx(textProps.right) ?? '0',
      'padding-top': withPx(textProps.top) ?? '0',
      'padding-bottom': withPx(textProps.bottom) ?? '0',
      'white-space': textProps.wrap ? 'normal' : 'nowrap',
      'overflow': textProps.overflow === 'visible' ? 'unset' : 'hidden'
    };
    let styleString = '';
    for (const k in style) {
      const v = style[k as keyof typeof style];
      styleString += `${k}: ${v};`;
    }

    const metadata = props.metadata ?? {};

    const valign = VALIGN_TO_FLEX_JUSTIFY[textProps.valign ?? 'middle'];

    const updateBounds = (w: number, h: number) => {
      if (w === this.width && h === this.height) return;
      this.width = w;
      this.height = h;
      props.onSizeChange?.({ w, h });
    };

    const def = props.node.getDefinition() as ShapeNodeDefinition;
    const handler = def.getTextHandler(props.node).inline;

    const pos = textProps.position;
    const w = ((textProps.width ?? 100) / 100) * props.bounds.w;
    const foreignObject = svg.foreignObject(
      {
        class: 'svg-node__fo',
        id: props.id,
        x: (
          props.bounds.x +
          (pos?.includes('w') ? -w : pos?.includes('e') ? w : (props.bounds.w - w) / 2)
        ).toString(),
        y: (
          props.bounds.y +
          (pos?.includes('n') ? -props.bounds.h : pos?.includes('s') ? props.bounds.h : 0)
        ).toString(),
        width: w.toString(),
        height: props.bounds.h.toString(),
        style: 'pointer-events: none;'
      },
      html.div(
        {
          class: 'svg-node__fo__inner',
          style: `justify-content: ${valign};`
        },
        [
          html.div(
            {
              class: 'svg-node__text',
              style: styleString,
              on: {
                paste: (e: ClipboardEvent) => {
                  const data = e.clipboardData!.getData('text/html');
                  (e.currentTarget! as HTMLElement).innerHTML = stripTags(data);

                  e.preventDefault();
                },
                keydown: (e: KeyboardEvent) => {
                  const target = e.target as HTMLElement;
                  if (e.key === 'Escape') {
                    target.innerHTML = storedToHTML(handler, props.text, metadata);
                    target.blur();
                  } else if (e.key === 'Enter' && e.metaKey) {
                    target.blur();
                  }

                  setTimeout(() => updateBounds(target.offsetWidth, target.offsetHeight), 0);
                },
                blur: (e: FocusEvent) => {
                  const target = e.target as HTMLElement;
                  target.contentEditable = 'false';
                  target.style.pointerEvents = 'none';

                  const newValue = editToStored(handler, target.innerHTML);
                  props.onChange(newValue);

                  target.innerHTML = storedToHTML(handler, newValue, metadata);

                  updateBounds(target.offsetWidth, target.offsetHeight);
                }
              },
              hooks: {
                onInsert: (n: VNode) => {
                  if (!props.text || props.text.trim() === '') return;

                  const target = n.el! as HTMLElement;
                  updateBounds(target.offsetWidth, target.offsetHeight);
                },
                onUpdate: (_o: VNode, n: VNode) => {
                  if (!props.text || props.text.trim() === '') return;

                  const target = n.el! as HTMLElement;
                  updateBounds(target.offsetWidth, target.offsetHeight);
                }
              }
            },
            [rawHTML(storedToHTML(handler, props.text, metadata))]
          )
        ]
      )
    );

    const mode = requiresForeignObject(props.text ?? '') ? 'foreignObject' : 'foreignObject';
    if (mode === 'foreignObject') {
      return svg.g(
        {
          transform:
            props.bounds.r === 0
              ? ''
              : `rotate(${Angle.toDeg(props.bounds.r)} ${Box.center(props.bounds).x} ${Box.center(props.bounds).y})`
        },
        foreignObject
      );
    }

    foreignObject.data.class = 'svg-node__fo svg-node__fo--with-text';

    const transformer = new HTMLToSvgTransformer();
    const parser = new HTMLParser(transformer);
    parser.parse(props.text ?? '');

    // TODO: Maybe use a transform on the text node to not have to rerender/realign as much

    return svg.g(
      {},
      foreignObject,
      svg.text(
        {
          'id': `${props.id}-text`,
          'x': props.bounds.x.toString(),
          'y': props.bounds.y.toString(),
          'data-width': props.bounds.w.toString(),
          'data-height': props.bounds.h.toString(),
          'style': `${styleString}pointer-events: none;`,
          'hooks': {
            onChildrenChanged: (n: VNode) => {
              const target = n.el! as SVGTextElement;

              const currentHash = target.dataset['hash'] ?? '';
              const newHash = hash64(
                new TextEncoder().encode(
                  JSON.stringify({
                    ...textProps,
                    width: props.bounds.w,
                    height: props.bounds.h
                  })
                )
              );

              const svgTextHelper = new SvgTextHelper(target);

              if (currentHash !== newHash) {
                svgTextHelper.reflow();
              }
              svgTextHelper.realign(textProps.align ?? 'left', textProps.valign ?? 'middle');
              svgTextHelper.apply();

              target.dataset['hash'] = newHash;
            }
          }
        },
        ...[rawHTML(transformer.svgTags)]
      )
    );
  }
}

const stripOuterPTags = (text: string) => {
  if (text.startsWith('<p>') && text.endsWith('</p>')) {
    // Extract the content between the outer <p> and </p>
    const content = text.slice(3, -4);

    // Only strip if there are no more <p> tags in the content
    if (!content.includes('<p>')) {
      return content;
    }
  }
  return text;
};
