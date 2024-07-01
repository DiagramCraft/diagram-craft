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
  metadata: DeepReadonly<Metadata> | undefined;
  text: NodeProps['text'];
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
      color: props.text?.color ?? 'unset',
      fill: props.text?.color ?? 'unset',

      fontFamily: props.text?.font ?? 'unset',
      fontSize: withPx(props.text?.fontSize) ?? 'unset',
      fontWeight: props.text?.bold ? 'bold' : 'normal',
      fontStyle: props.text?.italic ? 'italic' : 'normal',
      lineHeight: `${1.2 * (props.text?.lineHeight ?? 1) * 100}%`,
      minWidth: 'min-content',
      textDecoration: props.text?.textDecoration
        ? `${props.text.textDecoration} ${props.text.color ?? 'black'}`
        : 'none',
      textTransform: props.text?.textTransform ?? 'none',
      textAlign: props.text?.align ?? 'unset',
      paddingLeft: withPx(props.text?.left) ?? '0',
      paddingRight: withPx(props.text?.right) ?? '0',
      paddingTop: withPx(props.text?.top) ?? '0',
      paddingBottom: withPx(props.text?.bottom) ?? '0'
    };

    const metadata = props.metadata ?? {};

    const valign = VALIGN_TO_FLEX_JUSTIFY[props.text?.valign ?? 'middle'];

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
                    target.innerText = props.text?.text ?? '';
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
                  if (!props.text?.text || props.text.text.trim() === '') return;

                  const target = n.el! as HTMLElement;
                  updateBounds(target.offsetWidth, target.offsetHeight);
                },
                onUpdate: (_o: VNode, n: VNode) => {
                  if (!props.text?.text || props.text.text.trim() === '') return;

                  const target = n.el! as HTMLElement;
                  updateBounds(target.offsetWidth, target.offsetHeight);
                }
              }
            },
            [rawHTML(applyTemplate((props.text?.text ?? '').replaceAll('\n', '<br>'), metadata))]
          )
        ]
      )
    );

    const mode = requiresForeignObject(props.text?.text ?? '') ? 'foreignObject' : 'foreignObject';
    if (mode === 'foreignObject') {
      return foreignObject;
    }

    foreignObject.data.class = 'svg-node__fo svg-node__fo--with-text';

    const transformer = new HTMLToSvgTransformer();
    const parser = new HTMLParser(transformer);
    parser.parse(props.text?.text ?? '');

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
                    ...props.text,
                    width: props.bounds.w,
                    height: props.bounds.h
                  })
                )
              );

              const svgTextHelper = new SvgTextHelper(target);

              if (currentHash !== newHash) {
                svgTextHelper.reflow();
              }
              svgTextHelper.realign(props.text?.align ?? 'left', props.text?.valign ?? 'middle');
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
