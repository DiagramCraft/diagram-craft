import { ToolWindowButton } from './toolwindow/ToolWindowButton';
import React, { useEffect, useState } from 'react';
import { useEventListener } from './hooks/useEventListener';
import { Toolbar } from '@diagram-craft/app-components/Toolbar';
import { ErrorBoundary } from './ErrorBoundary';
import { UserState } from '../UserState';
import { IconType } from 'react-icons';

export const SideBarPage = (props: SideBarPage) => {
  return <ErrorBoundary>{props.children}</ErrorBoundary>;
};

type SideBarPage = {
  icon: IconType;
  children: React.ReactNode;
};

export const SideBarBottomToolbar = (props: { children: React.ReactNode }) => {
  return (
    <div className={'cmp-sidebar-bottom-toolbar'}>
      <Toolbar.Root direction={'vertical'}>{props.children}</Toolbar.Root>
    </div>
  );
};

export const SideBar = (props: Props) => {
  const propName = props.side === 'left' ? 'panelLeft' : 'panelRight';

  const userState = UserState.get();
  const [selected, setSelected] = useState(userState[propName] ?? -1);

  const updateSelected = (idx: number) => {
    setSelected(idx);
    userState[propName] = idx;
  };

  useEventListener(userState, 'change', () => {
    setSelected(userState[propName] ?? 0);
  });

  // TODO: Can we do this with CSS?
  //       potentially setting a variable
  const d = '15.5rem';
  useEffect(() => {
    if (props.side === 'left') {
      if (selected === -1) {
        document.getElementById(`toolbar`)!.style.marginLeft = '0';
        document.getElementById(`tabs`)!.style.marginLeft = '0';
        document.body.style.setProperty('--left-indent', '0px');
      } else {
        document.getElementById(`toolbar`)!.style.marginLeft = d;
        document.getElementById(`tabs`)!.style.marginLeft = d;
        document.body.style.setProperty('--left-indent', d);
      }
    } else {
      if (selected === -1) {
        document.getElementById(`toolbar`)!.style.marginRight = '0';
        document.getElementById(`tabs`)!.style.marginRight = '0';
        document.body.style.setProperty('--right-indent', '0px');
      } else {
        document.getElementById(`toolbar`)!.style.marginRight = d;
        document.getElementById(`tabs`)!.style.marginRight = d;
        document.body.style.setProperty('--right-indent', d);
      }
    }
  }, [props.side, selected]);

  return (
    <>
      <Toolbar.Root id={`${props.side}-buttons`} direction={'vertical'}>
        <Toolbar.ToggleGroup type={'single'}>
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

                  userState[propName] = idx;
                }}
              />
            );
          })}
        </Toolbar.ToggleGroup>
      </Toolbar.Root>
      <div
        id={`${props.side}`}
        className={'cmp-sidebar'}
        style={{ display: selected === -1 ? 'none' : 'block' }}
      >
        {props.children[selected]}
      </div>
      {props.bottom}
    </>
  );
};

type Props = {
  side: 'left' | 'right';
  children: React.ReactNode[];
  bottom?: React.ReactNode;
};
