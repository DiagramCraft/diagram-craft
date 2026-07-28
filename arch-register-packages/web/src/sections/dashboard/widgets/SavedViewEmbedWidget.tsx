import type { DashboardWidget } from '@arch-register/api-types/dashboardContract';
import { EntityViewEmbed } from '../../markdown/mdx-components/blocks/entity-view-embed/EntityViewEmbed';
import type { SavedViewEmbedWidgetConfig } from '../dashboardWidgetConfig';

type Props = {
  widget: DashboardWidget & { type: 'saved-view-embed'; config: SavedViewEmbedWidgetConfig };
};

export const SavedViewEmbedWidget = ({ widget }: Props) => (
  <EntityViewEmbed viewId={widget.config.viewId} />
);
