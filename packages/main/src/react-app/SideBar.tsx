import { ToolWindowButton } from './toolwindow/ToolWindowButton';
import React, { type ReactElement, useEffect, useState } from 'react';
import { useEventListener } from './hooks/useEventListener';
import { Toolbar } from '@diagram-craft/app-components/Toolbar';
import { ErrorBoundary } from './ErrorBoundary';
import { UserState } from '../UserState';
import { IconType } from 'react-icons';

export const SideBarPage = (props: SideBarPageProps) => {
  return <ErrorBoundary>{props.children}</ErrorBoundary>;
};

type SideBarPageProps = {
  icon: IconType;
  children: React.ReactNode;
  extra?: React.ReactNode;
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
            const element = c as ReactElement<SideBarPageProps>;
            const icon = element.props.icon;
            return (
              <div
                key={idx}
                style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}
              >
                <ToolWindowButton
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
                {element.props.extra && element.props.extra}
              </div>
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
