import { getComponentDefinition } from './componentRegistry';

export const RegisteredComponentIcon = ({ type, size }: { type: string; size: number }) => {
  const Icon = getComponentDefinition(type)?.icon;
  return Icon ? <Icon size={size} /> : null;
};
