import { ToolWindowButton } from './ToolWindowButton.tsx';
import React, { useEffect, useState } from 'react';

export const SideBar = (props: Props) => {
  const [selected, setSelected] = useState(-1);

  // TODO: Can we do this with CSS?
  useEffect(() => {
    if (props.side === 'left') {
      if (selected === -1) {
        document.getElementById(`toolbar`)!.style.marginLeft = '0';
      } else {
        document.getElementById(`toolbar`)!.style.marginLeft = '15rem';
      }
    } else {
      if (selected === -1) {
        document.getElementById(`toolbar`)!.style.marginRight = '0';
      } else {
        document.getElementById(`toolbar`)!.style.marginRight = '15rem';
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
              }}
            />
          );
        })}
      </div>
      <div id={`${props.side}`} style={{ display: selected === -1 ? 'none' : 'block' }}>
        {props.children[selected]}
      </div>
    </>
  );
};

type Props = {
  side: 'left' | 'right';
  children: React.ReactNode[];
};
