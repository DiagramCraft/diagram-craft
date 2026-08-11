import type { Baseline } from '@arch-register/api-types/baselineContract';
import type { SharedEntityBrowserSearchParams } from '../../routes/searchParams';

type BaselineContext = Pick<Baseline, 'id'>;

export const baselineContextSearch = (
  baseline: BaselineContext
): Partial<SharedEntityBrowserSearchParams> => ({
  baselineId: baseline.id,
  sidebarTab: 'baselines'
});
