import type React from 'react';
import { EntityCardBlock } from './blocks/entity-card/EntityCardBlock';
import { EntityFieldInline } from './inlines/entity-field/EntityFieldInline';

export type MdxComponentSpec = {
  component: React.ComponentType<Record<string, string>>;
  mode: 'block' | 'inline';
  allowedProps: ReadonlyArray<string>;
};

export const MDX_COMPONENTS = {
  EntityCard: {
    component: EntityCardBlock as unknown as React.ComponentType<Record<string, string>>,
    mode: 'block',
    allowedProps: ['id', 'fields'],
  },
  EntityField: {
    component: EntityFieldInline as unknown as React.ComponentType<Record<string, string>>,
    mode: 'inline',
    allowedProps: ['id', 'field'],
  },
} satisfies Record<string, MdxComponentSpec>;

export type MdxComponentName = keyof typeof MDX_COMPONENTS;
