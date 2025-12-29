import { ActionMapFactory } from '../keyMap';
import type { Context } from '../context';
import { collapsibleNodeActions } from '../shape/collapsible';
import { waypointDeleteActions } from './waypointDeleteAction';
import { edgeTextAddActions } from './edgeTextAddAction';

export const canvasActions: ActionMapFactory<Context> = context => ({
  ...collapsibleNodeActions(context),
  ...edgeTextAddActions(context),
  ...waypointDeleteActions(context)
});
