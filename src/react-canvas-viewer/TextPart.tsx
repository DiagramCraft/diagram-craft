import { MouseEventHandler, useEffect, useRef } from 'react';
import { Box } from '../geometry/box.ts';
import { Extent } from '../geometry/extent.ts';

const VALIGN_TO_FLEX_JUSTIFY = {
  top: 'flex-start',
  middle: 'center',
  bottom: 'flex-end'
};

const withPx = (n?: number) => (n ? n + 'px' : undefined);

// TODO: Maybe we can optimize to not have a foreignObject until a text node is created
export const TextPart = (props: Props) => {
  const ref = useRef<HTMLDivElement>(null);
  const widthRef = useRef<number>(0);
  const heightRef = useRef<number>(0);

  const sizeAffectingProps = [
    props.text?.font,
    props.text?.fontSize,
    props.text?.bold,
    props.text?.italic,
    props.text?.textDecoration,
    props.text?.textTransform,
    props.text?.align,
    props.text?.left,
    props.text?.right,
    props.text?.top,
    props.text?.bottom
  ];

  useEffect(() => {
    if (ref.current) {
      if (!props.text?.text) return;
      props.onSizeChange?.({
        w: ref.current.offsetWidth,
        h: ref.current.offsetHeight
      });
    }
  }, [props.onSizeChange, ref, ...sizeAffectingProps]);

  const valign = VALIGN_TO_FLEX_JUSTIFY[props.text?.valign ?? 'middle'];

  return (
    <foreignObject
      id={props.id}
      className={'svg-node__fo'}
      x={props.bounds.x}
      y={props.bounds.y}
      width={props.bounds.w}
      height={props.bounds.h}
      onMouseDown={props.onMouseDown}
    >
      <div
        className={'svg-node__fo__inner'}
        style={{ justifyContent: valign }}
        onDoubleClick={e => {
          const $textNode = e.currentTarget.firstChild as HTMLElement;
          $textNode.contentEditable = 'true';
          $textNode.style.pointerEvents = 'auto';
          $textNode.focus();
        }}
      >
        <div
          className={'svg-node__text'}
          ref={ref}
          style={{
            color: props.text?.color ?? 'unset',
            fontFamily: props.text?.font ?? 'unset',
            fontSize: withPx(props.text?.fontSize) ?? 'unset',
            fontWeight: props.text?.bold ? 'bold' : 'normal',
            fontStyle: props.text?.italic ? 'italic' : 'normal',
            minWidth: 'min-content',
            textDecoration: props.text?.textDecoration
              ? `${props.text.textDecoration} ${props.text?.color ?? 'black'}`
              : 'none',
            textTransform: props.text?.textTransform ?? 'none',
            textAlign: props.text?.align ?? 'unset',
            paddingLeft: withPx(props.text?.left) ?? '0',
            paddingRight: withPx(props.text?.right) ?? '0',
            paddingTop: withPx(props.text?.top) ?? '0',
            paddingBottom: withPx(props.text?.bottom) ?? '0'
          }}
          onKeyDown={e => {
            const target = e.target as HTMLElement;
            if (e.key === 'Escape') {
              target.innerText = props.text?.text ?? '';
              target.blur();
            } else if (e.key === 'Enter' && e.metaKey) {
              target.blur();
            }

            setTimeout(() => {
              const w = target.offsetWidth;
              const h = target.offsetHeight;
              if (w !== widthRef.current || h !== heightRef.current) {
                props.onSizeChange?.({ w, h });
                widthRef.current = w;
                heightRef.current = h;
              }
            }, 0);
          }}
          onBlur={e => {
            props.onChange(e.target.innerHTML);
            props.onSizeChange?.({
              w: (e.target as HTMLElement).offsetWidth,
              h: (e.target as HTMLElement).offsetHeight
            });
            e.target.contentEditable = 'false';
            e.target.style.pointerEvents = 'none';
          }}
          dangerouslySetInnerHTML={{ __html: props.text?.text ?? '' }}
        />
      </div>
    </foreignObject>
  );
};

type Props = {
  id: string;
  text: NodeProps['text'];
  bounds: Box;
  onMouseDown: MouseEventHandler;
  onChange: (text: string) => void;
  onSizeChange?: (size: Extent) => void;
};
