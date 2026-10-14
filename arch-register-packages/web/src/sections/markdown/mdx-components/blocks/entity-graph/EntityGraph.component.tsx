import { TbVectorTriangle } from 'react-icons/tb';
import { defineComponent } from '../../defineComponent';
import { flatConfigCodec } from '../../configSchema';
import { configBlockMdx } from '../configBlock';
import { EntityGraph } from './EntityGraph';
import { EntityGraphConfigForm } from './EntityGraphConfigForm';
import {
  entityGraphWidgetConfigSchema,
  normalizeEntityGraphDepth,
  normalizeEntityGraphDirection
} from './types';

export default defineComponent({
  type: 'EntityGraph',
  category: 'visualizations',
  name: 'Entity graph',
  description:
    'A clickable graph of the dependencies and relations around one entity. Works best at 6x4 or larger.',
  configSchema: entityGraphWidgetConfigSchema,
  dashboardWidget: {
    defaultW: 6,
    defaultH: 16,
    surfaces: ['workspace', 'project']
  },
  component: EntityGraph,
  configForm: EntityGraphConfigForm,
  icon: TbVectorTriangle,
  mdxComponent: configBlockMdx({
    type: 'EntityGraph',
    codec: flatConfigCodec(entityGraphWidgetConfigSchema, {
      attributeNames: { entityId: 'id' },
      normalize: config => ({
        ...config,
        depth: normalizeEntityGraphDepth(config.depth),
        direction: normalizeEntityGraphDirection(config.direction)
      })
    }),
    placeholder: 'Choose entity graph…',
    fullWidth: true,
    keywords: ['entity', 'graph', 'dependency', 'impact', 'relations']
  })
});
