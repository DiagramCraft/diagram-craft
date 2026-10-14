import type { ComponentType, ReactNode } from 'react';
import { getComponentDefinition } from './componentRegistry';

type Props = {
  type: string;
  props: Record<string, string>;
  children?: ReactNode;
};

/** Applies the MDX surface adapter before rendering the shared component. */
export const MdxComponentPreview = ({ type, props, children }: Props) => {
  const definition = getComponentDefinition(type, 'mdx');
  if (!definition) return null;

  const Component = definition.component as ComponentType<
    Record<string, unknown> & { children?: ReactNode }
  >;
  const componentProps = definition.mdx.mapProps
    ? definition.mdx.mapProps(props, definition.createDefaultConfig?.({}) ?? {})
    : props;

  return <Component {...componentProps}>{children}</Component>;
};
