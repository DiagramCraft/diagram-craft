import { ENTITY_CARD_TYPE } from './blocks/entity-card/EntityCardEditable';
import { entityCardSpec } from './blocks/entity-card/EntityCardRegistration';
import { ENTITY_FIELD_TYPE } from './inlines/entity-field/EntityFieldEditable';
import { entityFieldSpec } from './inlines/entity-field/EntityFieldRegistration';
import { ENTITY_MENTION_TYPE } from './inlines/entity-mention/EntityMentionEditable';
import { entityMentionSpec } from './inlines/entity-mention/EntityMentionRegistration';
import { ENTITY_LINK_TYPE } from './inlines/entity-link/EntityLinkEditable';
import { entityLinkSpec } from './inlines/entity-link/EntityLinkRegistration';
import type { MdxComponentSpec } from './types';
export type { SlashCommandDef, EditorSpec, MdxComponentSpec } from './types';

export const MDX_COMPONENTS = {
  [ENTITY_CARD_TYPE]: entityCardSpec,
  [ENTITY_FIELD_TYPE]: entityFieldSpec,
  [ENTITY_MENTION_TYPE]: entityMentionSpec,
  [ENTITY_LINK_TYPE]: entityLinkSpec
} satisfies Record<string, MdxComponentSpec>;

export type MdxComponentName = keyof typeof MDX_COMPONENTS;
