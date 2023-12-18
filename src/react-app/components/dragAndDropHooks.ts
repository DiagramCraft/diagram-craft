import React, { DragEventHandler, useState } from 'react';

type PendingDrop = {
  before?: string[];
  on?: string[];
  after?: string[];
};

type Drop<M extends string> = {
  [K in M]: {
    before?: string;
    on?: string;
    after?: string;
  };
};

export const useDraggable = <E extends HTMLElement>(
  data: string,
  mimeType: string,
  opts?: {
    onDragStart?: DragEventHandler<E>;
    onDragEnd?: DragEventHandler<E>;
    type?: 'move' | 'copy';
  }
) => {
  // Return all event listeners needed
  const onDragStart: DragEventHandler<E> = ev => {
    ev.currentTarget.style.opacity = '0.2';

    ev.dataTransfer.setData(mimeType, data);
    ev.dataTransfer.dropEffect = opts?.type ?? 'move';

    opts?.onDragStart?.(ev);

    console.log(mimeType);
    document.body.dataset['dragmimetype'] = mimeType;
  };
  const onDragEnd: DragEventHandler<E> = ev => {
    opts?.onDragEnd?.(ev);
    ev.currentTarget.style.opacity = 'unset';
    document.body.dataset['dragmimetype'] = undefined;
  };

  return {
    eventHandlers: {
      onDragStart,
      onDragEnd,
      draggable: true
    }
  };
};

export const useDropTarget = <E extends HTMLElement, M extends string>(
  mimeTypes: M[],
  dropHandler: (obj: Drop<M>) => void,
  opts?: {
    onDrop?: DragEventHandler<E>;
    onDragOver?: DragEventHandler<E>;
    onDragLeave?: DragEventHandler<E>;
    onDragEnter?: DragEventHandler<E>;
    type?: 'move' | 'copy';
    split?: (mimeType: M) => [number, number, number];
  }
) => {
  const [pendingDrop, setPendingDrop] = useState<PendingDrop | undefined>(undefined);

  // Return all event listeners needed
  const onDragEnter: DragEventHandler<E> = ev => {
    if (mimeTypes.some(mt => ev.dataTransfer.types.includes(mt))) {
      ev.currentTarget.classList.add('util-disable-nested-pointer-events');
      opts?.onDragEnter?.(ev);
    }
  };
  const onDragLeave: DragEventHandler<E> = ev => {
    if (mimeTypes.some(mt => ev.dataTransfer.types.includes(mt))) {
      ev.currentTarget.classList.remove('util-disable-nested-pointer-events');
      opts?.onDragLeave?.(ev);
      ev.currentTarget.dataset['pendingdrop'] = undefined;
    }
  };
  const onDragOver: DragEventHandler<E> = ev => {
    if (ev.dataTransfer.types.some(t => mimeTypes.includes(t as M))) {
      ev.dataTransfer.dropEffect = opts?.type ?? 'move';
      setPendingDrop({
        [getLocation(ev)]: mimeTypes.filter(mt => ev.dataTransfer.types.includes(mt))
      });

      ev.currentTarget.dataset['pendingdrop'] = getLocation(ev);

      opts?.onDragOver?.(ev);

      ev.preventDefault();
    }
  };
  const onDrop: DragEventHandler<E> = ev => {
    if (ev.dataTransfer.types.some(t => mimeTypes.includes(t as M))) {
      ev.currentTarget.dataset['pendingdrop'] = undefined;
      opts?.onDrop?.(ev);

      const keys = mimeTypes.filter(mt => ev.dataTransfer.types.includes(mt));

      const obj: Partial<Drop<M>> = {};
      for (const k of keys) {
        obj[k] = {
          [getLocation(ev)]: ev.dataTransfer.getData(k)
        };
      }
      dropHandler(obj as Drop<M>);
    }
  };

  const getLocation = <E extends HTMLElement>(ev: React.DragEvent<E>) => {
    const rect = ev.currentTarget.getBoundingClientRect();

    const keys = mimeTypes.filter(mt => ev.dataTransfer.types.includes(mt));
    const split = opts?.split?.(keys[0]) ?? [0.25, 0.5, 0.25];

    if (ev.clientY < rect.top + rect.height * split[0]) {
      return 'before';
    } else if (ev.clientY < rect.top + rect.height * (split[0] + split[1])) {
      return 'on';
    } else {
      return 'after';
    }
  };

  return {
    eventHandlers: {
      onDragEnter,
      onDragLeave,
      onDragOver,
      onDrop
    },
    pendingDrop
  };
};
