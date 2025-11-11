import { Point } from '@diagram-craft/geometry/point';
import { EmptyObject } from '@diagram-craft/utils/types';
import { model } from './modelState';
import { Observable } from './component/component';
import { ToolType } from './tool';
import { Modifiers } from './dragDropManager';
import type { Marquee } from './marquee';

export type OnMouseDown = (id: string, coord: Point, modifiers: Modifiers) => void;
export type OnDoubleClick = (id: string, coord: Point) => void;

export interface UIActions {
  showContextMenu: <T extends keyof UIActions.ContextMenus>(
    type: T,
    point: Point,
    mouseEvent: MouseEvent,
    args: UIActions.ContextMenus[T]
  ) => void;

  showNodeLinkPopup: (point: Point, sourceNodeId: string, edgeId: string) => void;

  /**
   * Show dialog using centralized dialog system. Dialogs must be registered in App.tsx.
   */
  // biome-ignore lint/suspicious/noExplicitAny: false positive
  showDialog: (command: DialogCommand<any, any>) => void;
}

export interface Help {
  set: (message: string) => void;
  push: (id: string, message: string) => void;
  pop: (id: string) => void;
}

export interface Context {
  model: typeof model;
  ui: UIActions;
  help: Help;
  tool: Observable<ToolType>;
  actions: Partial<DiagramCraft.ActionMap>;
  marquee: Marquee;
}

/**
 * Dialog command for centralized dialog system. All dialogs are rendered in App.tsx.
 * Pattern: Dialog components handle presentation, actions use onOk for business logic.
 */
export interface DialogCommand<P, D> {
  id: string; // Must match dialog ID check in App.tsx (e.g., dialogState?.id === 'comment')
  props: P; // Props passed to the dialog component
  onOk: (data: D) => void; // Business logic callback - handle data processing here
  onCancel?: () => void; // Optional cancel callback
}

type MessageDialogProps = {
  title: string;
  message: string;
  okLabel: string;
  okType?: 'default' | 'secondary' | 'danger';
  cancelLabel: string | undefined;
};

export class MessageDialogCommand implements DialogCommand<MessageDialogProps, EmptyObject> {
  id = 'message';

  constructor(
    public readonly props: MessageDialogProps,
    public readonly onOk: (data: EmptyObject) => void,
    public readonly onCancel: () => void = () => {}
  ) {}
}

export namespace UIActions {
  export interface ContextMenus extends DiagramCraft.ContextMenus {
    canvas: object;
    selection: object;
  }
}

export type ContextMenuTarget<
  T extends keyof UIActions.ContextMenus = keyof UIActions.ContextMenus
> = UIActions.ContextMenus[T] & {
  pos: Point;
} & {
  type: T;
};

declare global {
  namespace DiagramCraft {
    interface ContextMenus {}
  }
}
