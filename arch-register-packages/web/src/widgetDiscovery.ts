import type { WidgetDefinition } from './widgets/shared/types';
import { registerWidgetDefinitions } from './widgets/shared/widgetRegistry';

const compare = (left: string, right: string): number => (left < right ? -1 : left > right ? 1 : 0);

const componentDefinitions = Object.values(
  import.meta.glob<WidgetDefinition>('./**/*.widget.tsx', {
    eager: true,
    import: 'default'
  })
).sort((left, right) => compare(left.name, right.name) || compare(left.type, right.type));

registerWidgetDefinitions(componentDefinitions);
