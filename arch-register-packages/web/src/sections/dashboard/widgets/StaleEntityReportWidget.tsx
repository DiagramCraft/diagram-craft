import { EntityStaleReport } from '../../markdown/mdx-components/blocks/entity-stale-report/EntityStaleReport';
import type { EntityStaleReportProps } from '../../markdown/mdx-components/blocks/entity-stale-report/types';

type Props = {
  config: EntityStaleReportProps;
};

export const StaleEntityReportWidget = ({ config }: Props) => (
  <EntityStaleReport staleAfterDays={config.staleAfterDays} />
);
