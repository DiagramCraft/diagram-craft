import { newid } from '@diagram-craft/utils/id';
import { isEmptyString } from '@diagram-craft/utils/strings';
import type { NodeAction, NodeActionType, NodeProps } from './diagramProps';

export const DEFAULT_NODE_ACTION_LABEL = 'Default Action';

export type NodeActionRecord = NonNullable<NodeProps['actions']>;
export type ResolvedNodeAction = NodeAction & { id: string };

type LegacyNodeAction = {
  label?: string;
  type?: NodeActionType;
  url?: string;
};

export const isNodeActionExecutable = (action: Pick<NodeAction, 'type' | 'url'> | undefined) => {
  if (action === undefined) return false;
  if (action.type === undefined || action.type === 'none') return false;

  return !isEmptyString(action.url);
};

export const normalizeNodeActions = (props: NodeProps & { action?: LegacyNodeAction }) => {
  const normalizedActions: NodeActionRecord = {};

  for (const [id, action] of Object.entries(props.actions ?? {})) {
    normalizedActions[id] = {
      label: action.label ?? DEFAULT_NODE_ACTION_LABEL,
      type: action.type,
      url: action.url
    };
  }

  if (props.action !== undefined) {
    normalizedActions[newid()] = {
      label: props.action.label ?? DEFAULT_NODE_ACTION_LABEL,
      type: props.action.type ?? 'none',
      url: props.action.url
    };
  }

  if (Object.keys(normalizedActions).length > 0 || props.actions !== undefined) {
    props.actions = normalizedActions;
  }

  delete props.action;

  return props;
};

export const getResolvedNodeActions = (actions: NodeProps['actions']): ResolvedNodeAction[] => {
  return Object.entries(actions ?? {}).map(([id, action]) => ({
    id,
    label: action.label,
    type: action.type,
    url: action.url
  }));
};

export const getExecutableNodeActions = (actions: NodeProps['actions']): ResolvedNodeAction[] => {
  return getResolvedNodeActions(actions).filter(action => isNodeActionExecutable(action));
};
