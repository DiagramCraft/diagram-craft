import { useEffect, useState } from 'react';
import { useEventListener } from '../../hooks/useEventListener';
import { EdgeLinePanel } from './EdgeLinePanel';
import { NodeFillPanel } from './NodeFillPanel';
import { NodeTextPanel } from './NodeTextPanel';
import { ElementTransformPanel } from './ElementTransformPanel';
import { ElementCustomPropertiesPanel } from './ElementCustomPropertiesPanel';
import { ElementShadowPanel } from './ElementShadowPanel';
import { CanvasPanel } from './CanvasPanel';
import { CanvasGridPanel } from './CanvasGridPanel';
import { CanvasSnapPanel } from './CanvasSnapPanel';
import { NodeStrokePanel } from './NodeStrokePanel';
import { LabelNodePanel } from './LabelNodePanel';
import { NodeEffectsPanel } from './NodeEffectsPanel';
import { ElementStylesheetPanel } from './ElementStylesheetPanel';
import { EdgeEffectsPanel } from './EdgeEffectsPanel';
import * as Tabs from '@radix-ui/react-tabs';
import { $c } from '@diagram-craft/utils/classname';
import { NodeTablePropertiesPanel } from './NodeTablePropertiesPanel';
import { NodeTableStrokePanel } from './NodeTableStrokePanel';
import { NodeTableDimensionsPanel } from './NodeTableDimensionsPanel';
import { NodeTableCellDimensionsPanel } from './NodeTableCellDimensionsPanel';
import { Accordion } from '@diagram-craft/app-components/Accordion';
import { NodeTableToolbarPanel } from './NodeTableToolbarPanel';
import { useDiagram } from '../../../application';
import { useRedraw } from '../../hooks/useRedraw';
import { isNode } from '@diagram-craft/model/diagramElement';
import { ElementAnchorsPanel } from './ElementAnchorsPanel';
import { NodeActionPropertiesPanel } from './NodeActionPropertiesPanel';
import { NodeAdvancedPropertiesPanel } from './NodeAdvancedPropertiesPanel';
import { DefaultIndicatorPanel } from './DefaultIndicatorPanel';
import { NamedIndicatorPanel } from './NamedIndicatorPanel';

type Type = 'diagram' | 'mixed' | 'single-label-node' | 'node' | 'edge' | 'table' | 'table-cell';

type TabType = 'canvas' | 'style' | 'table' | 'cell' | 'text' | 'arrange' | 'advanced' | 'grid';

const TABS: Record<Type, TabType[]> = {
  'diagram': ['canvas', 'grid'],
  'node': ['style', 'text', 'arrange', 'advanced'],
  'edge': ['style'],
  'mixed': ['style', 'text', 'arrange'],
  'single-label-node': ['style', 'text'],
  'table': ['table', 'arrange', 'advanced'],
  'table-cell': ['cell', 'text']
};

export const ObjectToolWindow = () => {
  const diagram = useDiagram();
  const redraw = useRedraw();

  const [type, setType] = useState<Type>('diagram');
  const [tab, setTab] = useState<TabType>('style');
  const [edgeSupportsFill, setEdgeSupportsFill] = useState(false);

  useEffect(() => {
    if (TABS[type].includes(tab)) return;
    setTab(TABS[type][0]);
  }, [tab, type]);

  const callback = () => {
    if (
      diagram.selectionState.isNodesOnly() &&
      diagram.selectionState.nodes.every(e => e.nodeType === 'table')
    ) {
      setType('table');
    } else if (
      diagram.selectionState.isNodesOnly() &&
      diagram.selectionState.nodes.every(e => isNode(e.parent) && e.parent?.nodeType === 'tableRow')
    ) {
      setType('table-cell');
    } else if (diagram.selectionState.getSelectionType() === 'mixed') {
      setType('mixed');
    } else if (diagram.selectionState.getSelectionType() === 'single-label-node') {
      setType('single-label-node');
    } else if (diagram.selectionState.isNodesOnly()) {
      setType('node');
    } else if (diagram.selectionState.isEdgesOnly()) {
      setType('edge');
    } else {
      setType('diagram');
    }

    setEdgeSupportsFill(
      diagram.selectionState.isEdgesOnly() &&
        diagram.selectionState.edges.every(e => e.getDefinition().supports('fill'))
    );
  };
  useEventListener(diagram.selectionState, 'change', callback);
  useEffect(callback, [diagram.selectionState]);

  // To update overrides in style panel as rule layers are toggled
  useEventListener(diagram, 'change', redraw);

  const tabs = TABS[type];

  return (
    <Tabs.Root className={'cmp-tool-tabs'} value={tab} onValueChange={e => setTab(e as TabType)}>
      <Tabs.List className={$c('cmp-tool-tabs__tabs', { hidden: false })}>
        {tabs.includes('canvas') && (
          <Tabs.Trigger className="cmp-tool-tabs__tab-trigger util-vcenter" value={'canvas'}>
            Canvas
          </Tabs.Trigger>
        )}
        {tabs.includes('grid') && (
          <Tabs.Trigger className="cmp-tool-tabs__tab-trigger util-vcenter" value={'grid'}>
            Grid
          </Tabs.Trigger>
        )}
        {tabs.includes('style') && (
          <Tabs.Trigger className="cmp-tool-tabs__tab-trigger util-vcenter" value={'style'}>
            Style
          </Tabs.Trigger>
        )}
        {tabs.includes('table') && (
          <Tabs.Trigger className="cmp-tool-tabs__tab-trigger util-vcenter" value={'table'}>
            Style
          </Tabs.Trigger>
        )}
        {tabs.includes('cell') && (
          <Tabs.Trigger className="cmp-tool-tabs__tab-trigger util-vcenter" value={'cell'}>
            Style
          </Tabs.Trigger>
        )}
        {tabs.includes('text') && (
          <Tabs.Trigger className="cmp-tool-tabs__tab-trigger util-vcenter" value={'text'}>
            Text
          </Tabs.Trigger>
        )}
        {tabs.includes('arrange') && (
          <Tabs.Trigger className="cmp-tool-tabs__tab-trigger util-vcenter" value={'arrange'}>
            Arrange
          </Tabs.Trigger>
        )}
        {tabs.includes('advanced') && (
          <>
            <Tabs.Trigger className="cmp-tool-tabs__tab-trigger util-vcenter" value={'advanced'}>
              Advanced
            </Tabs.Trigger>
          </>
        )}
      </Tabs.List>

      {type === 'table' && (
        <Tabs.Content value={'table'}>
          <Accordion.Root type="multiple" defaultValue={['custom', 'dimensions', 'stroke']}>
            <NodeTableToolbarPanel />
            <ElementStylesheetPanel type={'node'} />

            <NodeTablePropertiesPanel />
            <NodeTableDimensionsPanel />
            <NodeTableStrokePanel />
          </Accordion.Root>
        </Tabs.Content>
      )}
      {type === 'table-cell' && (
        <Tabs.Content value={'cell'}>
          <Accordion.Root type="multiple" defaultValue={['fill', 'dimensions']}>
            <NodeTableToolbarPanel />
            <ElementStylesheetPanel type={'node'} />

            <NodeFillPanel />
            <NodeTableCellDimensionsPanel />
          </Accordion.Root>
        </Tabs.Content>
      )}

      {type === 'diagram' && (
        <>
          <Tabs.Content value={'canvas'}>
            <Accordion.Root type="multiple" defaultValue={['grid', 'canvas', 'snap']}>
              <CanvasPanel mode={'headless'} />
            </Accordion.Root>
          </Tabs.Content>

          <Tabs.Content value={'grid'}>
            <Accordion.Root type="multiple" defaultValue={['grid', 'canvas', 'snap']}>
              <CanvasGridPanel />
              <CanvasSnapPanel />
            </Accordion.Root>
          </Tabs.Content>
        </>
      )}

      <Tabs.Content value={'arrange'}>
        <Accordion.Root disabled={true} type="multiple" defaultValue={['transform']}>
          <ElementTransformPanel />
        </Accordion.Root>
      </Tabs.Content>

      <Tabs.Content value={'text'}>
        <Accordion.Root type="multiple" disabled={true} defaultValue={['text', 'label-node']}>
          <ElementStylesheetPanel type={'text'} />
          <NodeTextPanel />
        </Accordion.Root>
      </Tabs.Content>

      <Tabs.Content value={'style'}>
        <Accordion.Root
          type="multiple"
          defaultValue={['stylesheet', 'fill', 'stroke', 'line', 'custom', 'label-node']}
        >
          {type === 'node' && <ElementStylesheetPanel type={'node'} />}

          {(type === 'node' || type === 'mixed' || type === 'single-label-node') && (
            <>
              {type === 'single-label-node' && <LabelNodePanel />}
              <NodeFillPanel />
              <ElementShadowPanel />
              <NodeStrokePanel />
              <NodeEffectsPanel />
              <ElementCustomPropertiesPanel />
            </>
          )}

          {type === 'edge' && (
            <>
              <ElementStylesheetPanel type={'edge'} />
              {edgeSupportsFill && <NodeFillPanel />}
              <EdgeLinePanel />
              <ElementShadowPanel />
              <EdgeEffectsPanel />
              <ElementCustomPropertiesPanel />
            </>
          )}
        </Accordion.Root>
      </Tabs.Content>

      <Tabs.Content value={'advanced'}>
        <Accordion.Root type="multiple" defaultValue={['anchors', 'action-props', 'indicator']}>
          {type === 'node' && (
            <>
              <ElementAnchorsPanel />
              <NodeActionPropertiesPanel />
            </>
          )}
          {diagram.selectionState.getSelectionType().includes('single-') && (
            <>
              <DefaultIndicatorPanel />
              <NamedIndicatorPanel />
            </>
          )}

          <NodeAdvancedPropertiesPanel />
        </Accordion.Root>
      </Tabs.Content>
    </Tabs.Root>
  );
};
