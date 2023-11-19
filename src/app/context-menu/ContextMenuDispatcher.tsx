import React, { MutableRefObject } from 'react';

export function ContextMenuDispatcher<T>(props: Props<T>) {
  if (props.state?.current === null) return null;
  return props.createContextMenu(props.state.current);
}

type Props<T> = {
  state: MutableRefObject<T | null>;
  createContextMenu: (state: T) => React.ReactNode;
};
