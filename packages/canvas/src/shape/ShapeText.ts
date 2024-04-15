import { Component } from '../component/component';
import * as svg from '../component/vdom-svg';
import * as html from '../component/vdom-html';
import { rawHTML, toInlineCSS, VNode } from '../component/vdom';
import { Extent } from '@diagram-craft/geometry/extent';
import { Box } from '@diagram-craft/geometry/box';
import { Tool } from '../tool';

const VALIGN_TO_FLEX_JUSTIFY = {
  top: 'flex-start',
  middle: 'center',
  bottom: 'flex-end'
};

const withPx = (n?: number) => (n ? n + 'px' : undefined);

export type ShapeTextProps = {
  id: string;
  text: NodeProps['text'];
  bounds: Box;
  onMouseDown: (e: MouseEvent) => void;
  onChange: (text: string) => void;
  onSizeChange?: (size: Extent) => void;
  tool: Tool | undefined;
  isSingleSelected: boolean;
};

export class ShapeText extends Component<ShapeTextProps> {
  private width: number = 0;
  private height: number = 0;

  render(props: ShapeTextProps) {
    const style: Partial<CSSStyleDeclaration> = {
      color: props.text?.color ?? 'unset',
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

    const valign = VALIGN_TO_FLEX_JUSTIFY[props.text?.valign ?? 'middle'];

    const updateBounds = (w: number, h: number) => {
      if (w === this.width && h === this.height) return;
      this.width = w;
      this.height = h;
      props.onSizeChange?.({ w, h });
    };

    return svg.foreignObject(
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
          style: `justify-content: ${valign}`
        },
        [
          html.div(
            {
              class: 'svg-node__text',
              style: toInlineCSS(style),
              on: {
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
                  if (!props.text?.text) return;

                  const target = n.el! as HTMLElement;
                  updateBounds(target.offsetWidth, target.offsetHeight);
                },
                onUpdate: (_o: VNode, n: VNode) => {
                  const target = n.el! as HTMLElement;
                  updateBounds(target.offsetWidth, target.offsetHeight);
                }
              }
            },
            [rawHTML(props.text?.text ?? '')]
          )
        ]
      )
    );
  }
}
