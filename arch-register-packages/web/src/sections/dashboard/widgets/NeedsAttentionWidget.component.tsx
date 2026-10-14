/**
 * Dashboard-only widget: a queue of open governance cases against entities of a chosen schema,
 * restricted to a chosen set of case kinds — not tied to any particular app. Generalized from
 * API & Integration Catalog's and Data Stewardship's independently-built "needs attention" queues
 * (#3466); see `needsAttentionQueue.ts` for the shared query/join/severity logic.
 */
import { TbAlertTriangle } from 'react-icons/tb';
import { defineComponent } from '../../markdown/mdx-components/defineComponent';
import type { NeedsAttentionWidgetConfig } from './NeedsAttentionWidget';
import {
  NEEDS_ATTENTION_TYPE,
  NeedsAttentionConfigForm,
  NeedsAttentionWidget,
  isScope,
  isSeverity
} from './NeedsAttentionWidget';
export default defineComponent({
  type: NEEDS_ATTENTION_TYPE,
  category: 'data-views',
  name: 'Needs attention queue',
  description: 'Open governance cases against entities of a chosen type, awaiting a decision.',
  component: NeedsAttentionWidget,
  createDefaultProps: () => ({
    config: {
      schema: '',
      caseKinds: ['entity.change-case', 'entity.deprecation'],
      scope: 'workspace',
      severity: 'due-date',
      limit: 8
    }
  }),
  configForm: NeedsAttentionConfigForm,
  dashboardWidget: {
    icon: TbAlertTriangle,
    defaultW: 6,
    defaultH: 16,
    surfaces: ['workspace', 'project'],
    frame: { padded: false, showIcon: false },
    isValidConfig: (config): config is NeedsAttentionWidgetConfig =>
      typeof config.schema === 'string' &&
      Array.isArray(config.caseKinds) &&
      config.caseKinds.every(kind => typeof kind === 'string') &&
      isScope(config.scope) &&
      isSeverity(config.severity) &&
      typeof config.limit === 'number' &&
      config.limit > 0
  }
});
