import { Component } from '../component/component';
import * as svg from '../component/vdom-svg';
import * as html from '../component/vdom-html';
import { rawHTML, toInlineCSS, VNode } from '../component/vdom';
import { Extent } from '@diagram-craft/geometry/extent';
import { Box } from '@diagram-craft/geometry/box';
import { DeepReadonly } from '@diagram-craft/utils/types';
import { HTMLParser, stripTags } from '@diagram-craft/utils/html';
import { hash64 } from '@diagram-craft/utils/hash';
import { applyTemplate } from '@diagram-craft/model/template';
import { HTMLToSvgTransformer, SvgTextHelper } from './svgTextUtils';

const VALIGN_TO_FLEX_JUSTIFY = {
  top: 'flex-start',
  middle: 'center',
  bottom: 'flex-end'
};

const withPx = (n?: number) => (n ? n + 'px' : undefined);

export type ShapeTextProps = {
  id: string;
  metadata: DeepReadonly<Data> | undefined;
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

export class ShapeText extends Component<ShapeTextProps> {
  private width: number = 0;
  private height: number = 0;

  static edit(textId: string, elementId: string) {
    const domId = `text_${textId}_${elementId}`;

    const editable = getTextElement(domId);
    if (!editable) {
      console.warn('editable not found');
      return;
    }

    editable.contentEditable = 'true';
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
    const style: Partial<CSSStyleDeclaration> = {
      // TODO: color is not supported when using text
      color: props.textProps?.color ?? 'unset',
      fill: props.textProps?.color ?? 'unset',

      fontFamily: props.textProps?.font ?? 'unset',
      fontSize: withPx(props.textProps?.fontSize) ?? 'unset',
      fontWeight: props.textProps?.bold ? 'bold' : 'normal',
      fontStyle: props.textProps?.italic ? 'italic' : 'normal',
      lineHeight: `${1.2 * (props.textProps?.lineHeight ?? 1) * 100}%`,
      minWidth: 'min-content',
      textDecoration: props.textProps?.textDecoration
        ? `${props.textProps.textDecoration} ${props.textProps.color ?? 'black'}`
        : 'none',
      textTransform: props.textProps?.textTransform ?? 'none',
      textAlign: props.textProps?.align ?? 'unset',
      paddingLeft: withPx(props.textProps?.left) ?? '0',
      paddingRight: withPx(props.textProps?.right) ?? '0',
      paddingTop: withPx(props.textProps?.top) ?? '0',
      paddingBottom: withPx(props.textProps?.bottom) ?? '0'
    };

    const metadata = props.metadata ?? {};

    const valign = VALIGN_TO_FLEX_JUSTIFY[props.textProps?.valign ?? 'middle'];

    const updateBounds = (w: number, h: number) => {
      if (w === this.width && h === this.height) return;
      this.width = w;
      this.height = h;
      props.onSizeChange?.({ w, h });
    };

    const foreignObject = svg.foreignObject(
      {
        class: 'svg-node__fo',
        id: props.id,
        x: props.bounds.x.toString(),
        y: props.bounds.y.toString(),
        width: props.bounds.w.toString(),
        height: props.bounds.h.toString(),
        style: toInlineCSS({ pointerEvents: 'none' })
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
              style: toInlineCSS(style),
              on: {
                paste: (e: ClipboardEvent) => {
                  const data = e.clipboardData!.getData('text/html');
                  (e.currentTarget! as HTMLElement).innerHTML = stripTags(data);

                  e.preventDefault();
                },
                keydown: (e: KeyboardEvent) => {
                  const target = e.target as HTMLElement;
                  if (e.key === 'Escape') {
                    target.innerText = props.text ?? '';
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
                  props.onChange(target.innerHTML);

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
            [rawHTML(applyTemplate((props.text ?? '').replaceAll('\n', '<br>'), metadata))]
          )
        ]
      )
    );

    const mode = requiresForeignObject(props.text ?? '') ? 'foreignObject' : 'foreignObject';
    if (mode === 'foreignObject') {
      return foreignObject;
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
          'id': props.id + '-text',
          'x': props.bounds.x.toString(),
          'y': props.bounds.y.toString(),
          'data-width': props.bounds.w.toString(),
          'data-height': props.bounds.h.toString(),
          'style': toInlineCSS({ pointerEvents: 'none', ...style }),
          'hooks': {
            onChildrenChanged: (n: VNode) => {
              const target = n.el! as SVGTextElement;

              const currentHash = target.dataset['hash'] ?? '';
              const newHash = hash64(
                new TextEncoder().encode(
                  JSON.stringify({
                    ...props.textProps,
                    width: props.bounds.w,
                    height: props.bounds.h
                  })
                )
              );

              const svgTextHelper = new SvgTextHelper(target);

              if (currentHash !== newHash) {
                svgTextHelper.reflow();
              }
              svgTextHelper.realign(
                props.textProps?.align ?? 'left',
                props.textProps?.valign ?? 'middle'
              );
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
