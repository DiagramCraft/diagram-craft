import type React from 'react';
import { EntityCard } from './blocks/entity-card/EntityCard';
import { EntityField } from './inlines/entity-field/EntityField';

export type MdxComponentSpec = {
  component: React.ComponentType<Record<string, string>>;
  mode: 'block' | 'inline';
  allowedProps: ReadonlyArray<string>;
};

export const MDX_COMPONENTS = {
  EntityCard: {
    component: EntityCard as unknown as React.ComponentType<Record<string, string>>,
    mode: 'block',
    allowedProps: ['id', 'fields']
  },
  EntityField: {
    component: EntityField as unknown as React.ComponentType<Record<string, string>>,
    mode: 'inline',
    allowedProps: ['id', 'field']
  }
} satisfies Record<string, MdxComponentSpec>;

export type MdxComponentName = keyof typeof MDX_COMPONENTS;
