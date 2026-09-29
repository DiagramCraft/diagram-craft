import type { TElement } from 'platejs';
import { TbAlertTriangle } from 'react-icons/tb';
import { defineMdxComponent } from '../../markdown/mdx-components/defineMdxComponent';
import { NeedsAttentionWidget, type NeedsAttentionWidgetConfig } from './NeedsAttentionWidget';
import { NeedsAttentionConfigForm } from './NeedsAttentionConfigForm';

export const NEEDS_ATTENTION_TYPE = 'NeedsAttentionQueue' as const;

const isScope = (value: unknown): value is NeedsAttentionWidgetConfig['scope'] =>
  value === 'workspace' || value === 'mine' || value === 'late';

const isSeverity = (value: unknown): value is NeedsAttentionWidgetConfig['severity'] =>
  value === 'none' || value === 'due-date';

interface NeedsAttentionSlateElement extends TElement {}

/**
 * Dashboard-only widget: a queue of open governance cases against entities of a chosen schema,
 * restricted to a chosen set of case kinds — not tied to any particular app. Generalized from
 * API & Integration Catalog's and Data Stewardship's independently-built "needs attention" queues
 * (#3466); see `needsAttentionQueue.ts` for the shared query/join/severity logic.
 */
export const needsAttentionSpec = defineMdxComponent<
  NeedsAttentionSlateElement,
  { config: NeedsAttentionWidgetConfig },
  'block'
>({
  component: NeedsAttentionWidget,
  mode: 'block',
  allowedProps: [],
  dashboardWidget: {
    icon: TbAlertTriangle,
    label: 'Needs attention',
    description: 'Open governance cases against entities of a chosen type, awaiting a decision.',
    defaultW: 6,
    defaultH: 16,
    surfaces: ['workspace', 'project'],
    component: NeedsAttentionWidget,
    frame: { padded: false, showIcon: false },
    isValidConfig: (config): config is NeedsAttentionWidgetConfig =>
      typeof config.schema === 'string' &&
      Array.isArray(config.caseKinds) &&
      config.caseKinds.every(kind => typeof kind === 'string') &&
      isScope(config.scope) &&
      isSeverity(config.severity) &&
      typeof config.limit === 'number' &&
      config.limit > 0 &&
      (config.label === undefined || typeof config.label === 'string'),
    createDefaultConfig: () => ({
      schema: '',
      caseKinds: ['entity.change-case', 'entity.deprecation'],
      scope: 'workspace',
      severity: 'due-date',
      limit: 8
    }),
    getTitle: (config: NeedsAttentionWidgetConfig) => config.label?.trim() || 'Needs attention',
    configForm: NeedsAttentionConfigForm
  }
});
