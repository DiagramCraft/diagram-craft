import { Point } from '@diagram-craft/geometry/point';
import { EmptyObject } from '@diagram-craft/utils/types';
import { model } from './modelState';
import { Observable } from './component/component';
import { ToolType } from './tool';
import { Modifiers } from './dragDropManager';

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  actions: Partial<ActionMap>;
}

export interface DialogCommand<P, D> {
  id: string;
  props: P;
  onOk: (data: D) => void;
  onCancel?: () => void;
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

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace UIActions {
  export interface ContextMenus extends Extensions.ContextMenus {
    canvas: object;
    selection: object;
    edge: { id: string };
    node: { id: string };
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
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Extensions {
    interface ContextMenus {}
  }
}
