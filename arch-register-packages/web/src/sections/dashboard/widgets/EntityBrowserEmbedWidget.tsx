import { EntityBrowserEmbed } from '../../markdown/mdx-components/blocks/entity-browser-embed/EntityBrowserEmbed';
import {
  encodeEntityBrowserEmbedConfig,
  type EntityBrowserEmbedConfig
} from '../../markdown/mdx-components/blocks/entity-browser-embed/EntityBrowserEmbedCodec';

type Props = {
  config: EntityBrowserEmbedConfig;
};

export const EntityBrowserEmbedWidget = ({ config }: Props) => (
  <EntityBrowserEmbed config={encodeEntityBrowserEmbedConfig(config)} />
);
