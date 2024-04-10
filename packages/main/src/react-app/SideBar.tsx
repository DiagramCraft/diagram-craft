import { ToolWindowButton } from './ToolWindowButton';
import React, { useEffect, useState } from 'react';
import { useEventListener } from './hooks/useEventListener';
import { UserState } from '@diagram-craft/canvas/UserState';

export const SideBar = (props: Props) => {
  const propName = props.side === 'left' ? 'panelLeft' : 'panelRight';

  const [selected, setSelected] = useState(props.userState[propName] ?? -1);

  const updateSelected = (idx: number) => {
    setSelected(idx);
    props.userState[propName] = idx;
  };

  useEventListener(props.userState, 'change', () => {
    setSelected(props.userState[propName] ?? 0);
  });

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
  }, [props.side, selected]);

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
                  updateSelected(-1);
                  return;
                }
                updateSelected(idx);
                props.userState[propName] = idx;
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
  userState: UserState;
  children: React.ReactNode[];
};
