import { getWidgetDefinition } from './widgetRegistry';

export const RegisteredComponentIcon = ({ type, size }: { type: string; size: number }) => {
  const Icon = getWidgetDefinition(type)?.icon;
  return Icon ? <Icon size={size} /> : null;
};
