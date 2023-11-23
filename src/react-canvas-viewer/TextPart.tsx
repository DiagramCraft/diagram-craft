import { MouseEventHandler } from 'react';
import { Box } from '../geometry/box.ts';

// TODO: Maybe we can optimize to not have a foreignObject until a text node is created
export const TextPart = (props: Props) => {
  return (
    <foreignObject
      x={props.bounds.pos.x}
      y={props.bounds.pos.y}
      width={props.bounds.size.w}
      height={props.bounds.size.h}
      onMouseDown={props.onMouseDown}
      className={'node-fo'}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyItems: 'center',
          justifyContent: 'center',
          height: '100%',
          cursor: 'move'
        }}
        onDoubleClick={e => {
          const $t = e.target as HTMLDivElement;
          if ($t.parentNode?.nodeName === 'foreignObject') {
            ($t.firstChild as HTMLDivElement).contentEditable = 'true';
            ($t.firstChild as HTMLDivElement)?.focus();
          }
        }}
      >
        <div
          style={{
            color: 'black',
            fontSize: '11px',
            textAlign: 'center',
            cursor: 'text'
          }}
          onKeyDown={e => {
            if (e.key === 'Escape') {
              (e.target as HTMLDivElement).innerText = props.text ?? '';
              (e.target as HTMLDivElement).blur();
            } else if (e.key === 'Enter' && e.metaKey) {
              (e.target as HTMLDivElement).blur();
            }
          }}
          onBlur={e => {
            props.onChange(e.target.innerHTML);
            e.target.contentEditable = 'false';
          }}
          dangerouslySetInnerHTML={{ __html: props.text ?? '' }}
        />
      </div>
    </foreignObject>
  );
};

type Props = {
  text: string | undefined;
  bounds: Box;
  onMouseDown: MouseEventHandler;
  onChange: (text: string) => void;
};
