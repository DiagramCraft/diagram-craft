import { ToolWindowButton } from './ToolWindowButton.tsx';
import React, { useEffect, useState } from 'react';

export const SideBar = (props: Props) => {
  const [selected, setSelected] = useState(props.defaultSelected ?? -1);

  // TODO: Can we do this with CSS?
  //       potentially setting a variable
  const d = '15.5rem';
  useEffect(() => {
    if (props.side === 'left') {
      if (selected === -1) {
        document.getElementById(`toolbar`)!.style.marginLeft = '0';
        document.getElementById(`tabs`)!.style.marginLeft = '0';
        document.body.style.setProperty('--left-indent', '0');
      } else {
        document.getElementById(`toolbar`)!.style.marginLeft = d;
        document.getElementById(`tabs`)!.style.marginLeft = d;
        document.body.style.setProperty('--left-indent', d);
      }
    } else {
      if (selected === -1) {
        document.getElementById(`toolbar`)!.style.marginRight = '0';
        document.getElementById(`tabs`)!.style.marginRight = '0';
        document.body.style.setProperty('--right-indent', d);
      } else {
        document.getElementById(`toolbar`)!.style.marginRight = d;
        document.getElementById(`tabs`)!.style.marginRight = d;
        document.body.style.setProperty('--right-indent', d);
      }
    }
  }, [selected]);

  // TODO: Replace the buttons part with the Toolbar component
  return (
    <>
      <div id={`${props.side}-buttons`} className={'cmp-toolbar'} data-direction={'vertical'}>
        {props.children.map((c, idx) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const icon = (c as any).props.icon;
          return (
            <ToolWindowButton
              key={idx}
              icon={icon}
              isSelected={selected === idx}
              onClick={() => {
                if (selected === idx) {
                  setSelected(-1);
                  return;
                }
                setSelected(idx);
                props.onChange?.(idx);
              }}
            />
          );
        })}
      </div>
      <div
        id={`${props.side}`}
        className={'cmp-sidebar'}
        style={{ display: selected === -1 ? 'none' : 'block' }}
      >
        {props.children[selected]}
      </div>
    </>
  );
};

type Props = {
  side: 'left' | 'right';
  children: React.ReactNode[];
  defaultSelected?: number;
  onChange?: (idx: number) => void;
};
