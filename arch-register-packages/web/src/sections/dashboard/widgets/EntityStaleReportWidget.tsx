import { EntityStaleReport } from '../../markdown/mdx-components/widgets/entity-stale-report/EntityStaleReport';
import type { EntityStaleReportProps } from '../../markdown/mdx-components/widgets/entity-stale-report/types';

type Props = {
  config: EntityStaleReportProps;
};

export const EntityStaleReportWidget = ({ config }: Props) => (
  <EntityStaleReport staleAfterDays={config.staleAfterDays} />
);
