import { ToolWindowButton } from './toolwindow/ToolWindowButton';
import React, { type ReactElement, useCallback, useEffect, useRef, useState } from 'react';
import { useEventListener } from './hooks/useEventListener';
import { Toolbar } from '@diagram-craft/app-components/Toolbar';
import { ErrorBoundary } from './ErrorBoundary';
import { UserState } from '../UserState';
import { IconType } from 'react-icons';

const MIN_WIDTH = 248;
const MAX_WIDTH = 1024;
const DEFAULT_WIDTH = 248;
const MIN_DIAGRAM_WIDTH = 300;
const TOOLBAR_WIDTH = 40; // Width of left and right button toolbars

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
  const widthPropName = props.side === 'left' ? 'panelLeftWidth' : 'panelRightWidth';

  const userState = UserState.get();
  const [selected, setSelected] = useState(userState[propName] ?? -1);
  const [width, setWidth] = useState(userState[widthPropName]);
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);

  const updateSelected = (idx: number) => {
    setSelected(idx);
    userState[propName] = idx;
  };

  useEventListener(userState, 'change', () => {
    setSelected(userState[propName] ?? 0);
  });

  const updateWidth = useCallback(
    (newWidth: number) => {
      // Get the other sidebar's width (0 if not shown)
      const otherSide = props.side === 'left' ? 'panelRight' : 'panelLeft';
      const otherWidthProp = props.side === 'left' ? 'panelRightWidth' : 'panelLeftWidth';
      const otherSideSelected = userState[otherSide] ?? -1;
      const otherSideWidth = otherSideSelected === -1 ? 0 : userState[otherWidthProp];

      // Calculate available space: window width - toolbars - other sidebar - minimum diagram width
      const windowWidth = window.innerWidth;
      const maxAllowedWidth = windowWidth - TOOLBAR_WIDTH * 2 - otherSideWidth - MIN_DIAGRAM_WIDTH;

      // Clamp width between MIN_WIDTH and the minimum of MAX_WIDTH and maxAllowedWidth
      const clampedWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, maxAllowedWidth, newWidth));
      setWidth(clampedWidth);
      userState[widthPropName] = clampedWidth;
    },
    [widthPropName, userState, props.side]
  );

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = width;
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta =
        props.side === 'left' ? e.clientX - resizeStartX.current : resizeStartX.current - e.clientX;
      const newWidth = resizeStartWidth.current + delta;
      updateWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, props.side, updateWidth]);

  // Handle window resize to ensure minimum diagram width is maintained
  useEffect(() => {
    const handleWindowResize = () => {
      // Re-validate width when window is resized
      updateWidth(width);
    };

    window.addEventListener('resize', handleWindowResize);
    return () => {
      window.removeEventListener('resize', handleWindowResize);
    };
  }, [width, updateWidth]);

  useEffect(() => {
    const widthPx = `${width}px`;
    if (props.side === 'left') {
      if (selected === -1) {
        document.getElementById(`toolbar`)!.style.marginLeft = '0';
        document.getElementById(`tabs`)!.style.marginLeft = '0';
        document.body.style.setProperty('--left-indent', '0px');
      } else {
        document.getElementById(`toolbar`)!.style.marginLeft = widthPx;
        document.getElementById(`tabs`)!.style.marginLeft = widthPx;
        document.body.style.setProperty('--left-indent', widthPx);
      }
    } else {
      if (selected === -1) {
        document.getElementById(`toolbar`)!.style.marginRight = '0';
        document.getElementById(`tabs`)!.style.marginRight = '0';
        document.body.style.setProperty('--right-indent', '0px');
      } else {
        document.getElementById(`toolbar`)!.style.marginRight = widthPx;
        document.getElementById(`tabs`)!.style.marginRight = widthPx;
        document.body.style.setProperty('--right-indent', widthPx);
      }
    }
  }, [props.side, selected, width]);

  return (
    <>
      <Toolbar.Root id={`${props.side}-buttons`} direction={'vertical'}>
        <div>
          {props.children.map((c, idx) => {
            const element = c as ReactElement<SideBarPageProps>;
            if (!element) return element;
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
        </div>
      </Toolbar.Root>
      <div
        id={`${props.side}`}
        className={'cmp-sidebar'}
        style={{ display: selected === -1 ? 'none' : 'block' }}
      >
        <div
          className={`cmp-sidebar-resize-handle cmp-sidebar-resize-handle-${props.side}`}
          onMouseDown={handleResizeStart}
          onDoubleClick={() => updateWidth(DEFAULT_WIDTH)}
          style={{ cursor: isResizing ? 'col-resize' : undefined }}
        />
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
