import { useCallback, useEffect, useState } from 'react';
import { useEventListener } from '../hooks/useEventListener';
import { useDiagram } from '../../application';
import { type Diagram, type DiagramView } from '@diagram-craft/model/diagram';
import { Select } from '@diagram-craft/app-components/Select';

const deriveActiveViewId = (diagram: Diagram): string | undefined => {
  const visibleIds = new Set(diagram.layers.visible.map(l => l.id));

  for (const view of diagram.views.all) {
    const viewIds = new Set(view.layers);
    if (viewIds.size === visibleIds.size && [...visibleIds].every(id => viewIds.has(id))) {
      return view.id;
    }
  }

  if (diagram.views.all.length === 1) {
    const allIds = new Set(diagram.layers.all.map(l => l.id));
    if (visibleIds.size === allIds.size && [...allIds].every(id => visibleIds.has(id))) {
      return 'all';
    }
  }

  return undefined;
};

const applyView = (diagram: Diagram, targetLayerIds: Set<string>) => {
  for (const layer of diagram.layers.all) {
    const shouldBeVisible = targetLayerIds.has(layer.id);
    const isVisible = diagram.layers.visible.includes(layer);
    if (shouldBeVisible !== isVisible) {
      diagram.layers.toggleVisibility(layer);
    }
  }
};

export const ViewSelectorToolbarButton = () => {
  const diagram = useDiagram();
  const [views, setViews] = useState<DiagramView[]>(() => [...diagram.views.all]);
  const [activeViewId, setActiveViewId] = useState<string | undefined>(() =>
    deriveActiveViewId(diagram)
  );

  const updateViews = useCallback(() => {
    setViews([...diagram.views.all]);
    setActiveViewId(deriveActiveViewId(diagram));
  }, [diagram]);

  useEventListener(diagram.views, 'viewChange', updateViews);
  useEventListener(diagram.layers, 'layerStructureChange', updateViews);
  useEffect(updateViews, [updateViews]);

  if (views.length === 0) return null;

  return (
    <div
      style={{
        marginLeft: 'auto',
        marginRight: '0.5rem',
        width: 'fit-content',
        display: 'flex',
        gap: '4px',
        alignItems: 'center',
        marginTop: '-5px'
      }}
    >
      <div style={{ fontSize: '11px', color: 'var(--base-fg-dim)' }}>View:</div>
      <div style={{ width: 'fit-content', flexShrink: 0 }}>
        <Select.Root
          value={activeViewId}
          onChange={id => {
            if (!id) return;
            if (id === 'all') {
              applyView(diagram, new Set(diagram.layers.all.map(l => l.id)));
            } else {
              const view = diagram.views.byId(id);
              if (view) applyView(diagram, new Set(view.layers));
            }
          }}
          placeholder="— View —"
          style={{ width: 'auto' }}
        >
          {views.map(v => (
            <Select.Item key={v.id} value={v.id}>
              {v.name}
            </Select.Item>
          ))}
          {views.length === 1 && <Select.Item value="all">All</Select.Item>}
        </Select.Root>
      </div>
    </div>
  );
};
