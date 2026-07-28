import { EntityViewEmbed } from '../../markdown/mdx-components/blocks/entity-view-embed/EntityViewEmbed';
import type { SavedViewEmbedWidgetConfig } from '../../markdown/mdx-components/blocks/entity-view-embed/types';

type Props = {
  config: SavedViewEmbedWidgetConfig;
};

export const SavedViewEmbedWidget = ({ config }: Props) => (
  <EntityViewEmbed viewId={config.viewId} />
);
