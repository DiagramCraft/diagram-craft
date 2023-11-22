import { ToolWindowButton } from './ToolWindowButton.tsx';
import React, { useState } from 'react';

export const SideBar = (props: Props) => {
  const [selected, setSelected] = useState(0);

  // TODO: Replace the buttons part with the Toolbar component
  return (
    <>
      <div id={`${props.side}-buttons`}>
        {props.children.map((c, idx) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const icon = (c as any).props.icon;
          return (
            <ToolWindowButton
              key={idx}
              icon={icon}
              isSelected={selected === idx}
              onClick={() => setSelected(idx)}
            />
          );
        })}
      </div>
      <div id={`${props.side}`}>{props.children[selected]}</div>
    </>
  );
};

type Props = {
  side: 'left' | 'right';
  children: React.ReactNode[];
};
