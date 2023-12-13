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
  const valign = VALIGN_TO_FLEX_JUSTIFY[props.text?.valign ?? 'middle'];
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
      props.onSizeChange?.({
        w: ref.current.getBoundingClientRect().width,
        h: ref.current.getBoundingClientRect().height
      });
    }
  }, [props.onSizeChange, ref, ...sizeAffectingProps]);

  return (
    <foreignObject
      id={props.id}
      x={props.bounds.pos.x}
      y={props.bounds.pos.y}
      width={props.bounds.size.w}
      height={props.bounds.size.h}
      onMouseDown={props.onMouseDown}
      className={'svg-node__fo'}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: valign,
          height: '100%',
          cursor: 'move'
        }}
        onDoubleClick={e => {
          const $t = e.target as HTMLDivElement;
          // TODO: Maybe we can make this case use classes instead of looking at parent
          if ($t.parentNode?.nodeName === 'foreignObject') {
            ($t.firstChild as HTMLDivElement).contentEditable = 'true';
            ($t.firstChild as HTMLDivElement)?.focus();
          } else if ($t.parentNode?.parentNode?.nodeName === 'foreignObject') {
            ($t as HTMLDivElement).contentEditable = 'true';
            ($t as HTMLDivElement)?.focus();
          }
        }}
      >
        <div
          className={'svg-node__text'}
          ref={ref}
          style={{
            cursor: 'move',
            color: props.text?.color ?? 'unset',
            fontFamily: props.text?.font ?? 'unset',
            fontSize: withPx(props.text?.fontSize) ?? 'unset',
            fontWeight: props.text?.bold ? 'bold' : 'normal',
            fontStyle: props.text?.italic ? 'italic' : 'normal',
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
            if (e.key === 'Escape') {
              (e.target as HTMLDivElement).innerText = props.text?.text ?? '';
              (e.target as HTMLDivElement).blur();
            } else if (e.key === 'Enter' && e.metaKey) {
              (e.target as HTMLDivElement).blur();
            }

            setTimeout(() => {
              const newWidth = (e.target as HTMLElement).getBoundingClientRect().width;
              const newHeight = (e.target as HTMLElement).getBoundingClientRect().height;
              if (newWidth !== widthRef.current || newHeight !== heightRef.current) {
                props.onSizeChange?.({
                  w: newWidth,
                  h: newHeight
                });
                widthRef.current = newWidth;
                heightRef.current = newHeight;
              }
            }, 0);
          }}
          onBlur={e => {
            props.onChange(e.target.innerHTML);
            props.onSizeChange?.({
              w: (e.target as HTMLElement).getBoundingClientRect().width,
              h: (e.target as HTMLElement).getBoundingClientRect().height
            });
            e.target.contentEditable = 'false';
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
