import { LoadingState } from '../../../components/LoadingState';
import { useWidgetBodyTitle } from '../../../sections/dashboard/widgets/WidgetBodyTitle';

import { countDueWithin, renderSubtext } from '../dataStewardshipDashboardLogic';
import {
  NotConfigured,
  StatTile,
  TONE_COLOR,
  useCaseQueue,
  type CaseCountConfig
} from '../dataStewardshipWidgetSupport';

export const CaseCountWidget = ({ config }: { config: CaseCountConfig }) => {
  const title = useWidgetBodyTitle();
  const queue = useCaseQueue(config);
  if (queue.isLoading) return <LoadingState text="Loading…" size="sm" />;
  if (!queue.isConfigured) return <NotConfigured />;
  const count = queue.items.length;
  const due = countDueWithin(queue.items, config.dueWithinDays);
  return (
    <StatTile
      label={title ?? 'Cases'}
      value={count}
      sub={renderSubtext(config.subtextTemplate, count, due)}
      color={count > 0 ? TONE_COLOR[config.tone] : undefined}
    />
  );
};
