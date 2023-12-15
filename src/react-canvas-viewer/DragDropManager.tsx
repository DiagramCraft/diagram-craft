import React, { createContext, useContext, useMemo, useRef } from 'react';
import { Drag } from '../base-ui/drag.ts';

export type DragDropContextType = {
  initiate(drag: Drag): void;
  current(): Drag | undefined;
  clear(): void;
};

export const DragDropContext = createContext<DragDropContextType | undefined>(undefined);

export const useDragDrop = () => {
  return useContext(DragDropContext)!;
};

export const DragDropManager = (props: Props) => {
  const dragRef = useRef<Drag | undefined>(undefined);

  const ctx = useMemo(() => {
    return {
      initiate(drag: Drag) {
        dragRef.current = drag;
      },
      current() {
        return dragRef.current;
      },
      clear() {
        dragRef.current = undefined;
      }
    };
  }, [dragRef]);

  return <DragDropContext.Provider value={ctx}>{props.children}</DragDropContext.Provider>;
};

type Props = {
  children: React.ReactNode;
};
