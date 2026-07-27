import type { DashboardWidget } from '@arch-register/api-types/dashboardContract';
import { EntityViewEmbed } from '../../markdown/mdx-components/blocks/entity-view-embed/EntityViewEmbed';

type Props = {
  widget: Extract<DashboardWidget, { type: 'saved-view-embed' }>;
};

export const SavedViewEmbedWidget = ({ widget }: Props) => (
  <EntityViewEmbed viewId={widget.viewId} />
);
