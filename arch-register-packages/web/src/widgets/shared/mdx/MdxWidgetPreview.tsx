import type { ComponentType, ReactNode } from 'react';
import { createDefaultConfig, getWidgetDefinition } from '../widgetRegistry';

type Props = {
  type: string;
  props: Record<string, string>;
  children?: ReactNode;
};

/** Applies the MDX surface adapter before rendering the shared component. */
export const MdxWidgetPreview = ({ type, props, children }: Props) => {
  const definition = getWidgetDefinition(type, 'mdx');
  if (!definition) return null;

  const Component = definition.component as ComponentType<
    Record<string, unknown> & { children?: ReactNode }
  >;
  const componentProps = definition.mdx.mapProps
    ? definition.mdx.mapProps(props, createDefaultConfig(definition, {}))
    : props;

  return <Component {...componentProps}>{children}</Component>;
};
