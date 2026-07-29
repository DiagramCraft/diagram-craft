import { EntityChangelog } from '../../markdown/mdx-components/blocks/entity-changelog/EntityChangelog';
import type { EntityChangelogWidgetConfig } from '../../markdown/mdx-components/blocks/entity-changelog/types';

type Props = {
  config: EntityChangelogWidgetConfig;
};

export const EntityChangelogWidget = ({ config }: Props) => (
  <EntityChangelog
    id={config.entityId}
    schema={config.schema}
    owner={config.owner}
    lifecycle={config.lifecycle}
    limit={config.limit}
    since={config.since}
  />
);
