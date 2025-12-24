import { ActionMapFactory } from '../keyMap';
import type { Context } from '../context';
import { containerShapeActions } from '../node-types/Container.nodeType';
import { waypointDeleteActions } from './waypointDeleteAction';
import { edgeTextAddActions } from './edgeTextAddAction';

export const canvasActions: ActionMapFactory<Context> = context => ({
  ...containerShapeActions(context),
  ...edgeTextAddActions(context),
  ...waypointDeleteActions(context)
});
