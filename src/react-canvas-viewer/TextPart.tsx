import { MouseEventHandler } from 'react';
import { Box } from '../geometry/box.ts';
import { useConfiguration } from '../react-app/context/ConfigurationContext.tsx';

const VALIGN_TO_FLEX_JUSTIFY = {
  top: 'flex-start',
  middle: 'center',
  bottom: 'flex-end'
};

const withPx = (n?: number) => (n ? n + 'px' : undefined);

// TODO: Maybe we can optimize to not have a foreignObject until a text node is created
export const TextPart = (props: Props) => {
  const { defaults } = useConfiguration();
  const valign = VALIGN_TO_FLEX_JUSTIFY[props.text?.valign ?? 'middle'];

  // TODO: We must get the correct props defaults here

  const textColor = props.text?.color ?? defaults?.node?.text?.color ?? 'unset';

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
          style={{
            cursor: 'text',
            color: textColor,
            fontFamily: props.text?.font ?? 'sans-serif',
            fontSize: (props.text?.fontSize ?? '10') + 'px',
            fontWeight: props.text?.bold ? 'bold' : 'normal',
            fontStyle: props.text?.italic ? 'italic' : 'normal',
            textDecoration: props.text?.textDecoration
              ? `${props.text.textDecoration} ${props.text?.color ?? 'black'}`
              : 'none',
            textTransform: props.text?.textTransform ?? 'none',
            textAlign: props.text?.align ?? 'center',
            paddingLeft: withPx(props.text?.left) ?? '0px',
            paddingRight: withPx(props.text?.right) ?? '0px',
            paddingTop: withPx(props.text?.top) ?? '0px',
            paddingBottom: withPx(props.text?.bottom) ?? '0px'
          }}
          onKeyDown={e => {
            if (e.key === 'Escape') {
              (e.target as HTMLDivElement).innerText = props.text?.text ?? '';
              (e.target as HTMLDivElement).blur();
            } else if (e.key === 'Enter' && e.metaKey) {
              (e.target as HTMLDivElement).blur();
            }
          }}
          onBlur={e => {
            props.onChange(e.target.innerHTML);
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
};
