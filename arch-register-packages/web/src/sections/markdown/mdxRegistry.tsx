import { ENTITY_CARD_TYPE } from './editor/blocks/entity-card/EntityCardEditable';
import { entityCardSpec } from './editor/blocks/entity-card/EntityCardRegistration';
import { ENTITY_FIELD_TYPE } from './editor/inlines/entity-field/EntityFieldEditable';
import { entityFieldSpec } from './editor/inlines/entity-field/EntityFieldRegistration';
import type { MdxComponentSpec } from './types';
export type { SlashCommandDef, EditorSpec, MdxComponentSpec } from './types';

export const MDX_COMPONENTS = {
  [ENTITY_CARD_TYPE]: entityCardSpec,
  [ENTITY_FIELD_TYPE]: entityFieldSpec,
} satisfies Record<string, MdxComponentSpec>;

export type MdxComponentName = keyof typeof MDX_COMPONENTS;
