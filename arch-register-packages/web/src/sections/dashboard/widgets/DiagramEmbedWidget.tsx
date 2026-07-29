import { DiagramEmbed } from '../../markdown/mdx-components/blocks/diagram-embed/DiagramEmbed';
import type { DiagramEmbedWidgetConfig } from '../../markdown/mdx-components/blocks/diagram-embed/types';

type Props = {
  config: DiagramEmbedWidgetConfig;
};

export const DiagramEmbedWidget = ({ config }: Props) => (
  <DiagramEmbed id={config.fileId} caption={config.caption} />
);
