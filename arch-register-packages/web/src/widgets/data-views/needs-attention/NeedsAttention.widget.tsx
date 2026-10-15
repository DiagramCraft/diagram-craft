/**
 * Dashboard-only widget: a queue of open governance cases against entities of a chosen schema,
 * restricted to a chosen set of case kinds — not tied to any particular app. Generalized from
 * API & Integration Catalog's and Data Stewardship's independently-built "needs attention" queues
 * (#3466); see `needsAttentionQueue.ts` for the shared query/join/severity logic.
 */
import { TbAlertTriangle } from 'react-icons/tb';
import { defineWidget } from '../../shared/defineWidget';
import {
  NeedsAttentionConfigForm,
  NeedsAttentionWidget,
  needsAttentionWidgetConfigSchema
} from './NeedsAttention';
export default defineWidget({
  type: 'NeedsAttentionQueue',
  category: 'data-views',
  name: 'Needs attention queue',
  description: 'Open governance cases against entities of a chosen type, awaiting a decision.',
  icon: TbAlertTriangle,
  component: NeedsAttentionWidget,
  configForm: NeedsAttentionConfigForm,
  configSchema: needsAttentionWidgetConfigSchema,
  dashboard: {
    defaultW: 6,
    defaultH: 16,
    surfaces: ['workspace', 'project'],
    frame: { padded: false, showIcon: false }
  }
});
