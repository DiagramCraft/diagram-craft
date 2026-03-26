import { isEmptyString } from '@diagram-craft/utils/strings';
import type { NodeAction, NodeProps } from './diagramProps';

export const DEFAULT_NODE_ACTION_LABEL = 'Default Action';

export type NodeActionRecord = NonNullable<NodeProps['actions']>;
export type ResolvedNodeAction = NodeAction & { id: string };

export const isNodeActionExecutable = (action: Pick<NodeAction, 'type' | 'url'> | undefined) => {
  if (action === undefined) return false;
  if (action.type === undefined || action.type === 'none') return false;

  return !isEmptyString(action.url);
};

export const getResolvedNodeActions = (actions: NodeProps['actions']): ResolvedNodeAction[] => {
  return Object.entries(actions ?? {}).map(([id, action]) => ({
    id,
    label: action.label,
    type: action.type,
    url: action.url
  }));
};

export const getNodeActions = (actions: NodeProps['actions']): ResolvedNodeAction[] => {
  return getResolvedNodeActions(actions).filter(action => isNodeActionExecutable(action));
};
