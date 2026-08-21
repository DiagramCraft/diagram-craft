import type { TElement } from 'platejs';
import { TbShieldCheck } from 'react-icons/tb';
import { defineMdxComponent } from '../../markdown/mdx-components/defineMdxComponent';
import {
  ConformanceSummaryWidget,
  type ConformanceSummaryWidgetConfig
} from './ConformanceSummaryWidget';

export const CONFORMANCE_SUMMARY_TYPE = 'conformance-violation-summary' as const;

interface ConformanceSummarySlateElement extends TElement {}

export const conformanceSummarySpec = defineMdxComponent<
  ConformanceSummarySlateElement,
  { config: ConformanceSummaryWidgetConfig },
  'block'
>({
  component: ConformanceSummaryWidget,
  mode: 'block',
  allowedProps: [],
  dashboardWidget: {
    icon: TbShieldCheck,
    label: 'Conformance summary',
    description: 'Current conformance violations grouped by severity and check.',
    defaultW: 5,
    defaultH: 4,
    surfaces: ['workspace'],
    component: ConformanceSummaryWidget,
    isValidConfig: (config): config is ConformanceSummaryWidgetConfig =>
      Object.keys(config).length === 0,
    createDefaultConfig: () => ({})
  }
});
