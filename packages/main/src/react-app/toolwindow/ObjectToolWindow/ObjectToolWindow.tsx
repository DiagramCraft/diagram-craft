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
import { ToolWindow } from '../ToolWindow';

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
  const [edgeSupportsFill, setEdgeSupportsFill] = useState(false);

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
    <ToolWindow.Root id={'object-tool'} defaultTab={'style'}>
      {tabs.includes('canvas') && (
        <ToolWindow.Tab id={'canvas'} title={'Canvas'}>
          <ToolWindow.TabContent>
            <Accordion.Root type="multiple" defaultValue={['canvas']}>
              <CanvasPanel mode={'headless'} />
            </Accordion.Root>
          </ToolWindow.TabContent>
        </ToolWindow.Tab>
      )}
      {tabs.includes('grid') && (
        <ToolWindow.Tab id={'grid'} title={'Grid'}>
          <ToolWindow.TabContent>
            <Accordion.Root type="multiple" defaultValue={['grid', 'snap']}>
              <CanvasGridPanel />
              <CanvasSnapPanel />
            </Accordion.Root>
          </ToolWindow.TabContent>
        </ToolWindow.Tab>
      )}
      {tabs.includes('style') && (
        <ToolWindow.Tab id={'style'} title={'Style'}>
          <ToolWindow.TabContent>
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
          </ToolWindow.TabContent>
        </ToolWindow.Tab>
      )}
      {tabs.includes('table') && (
        <ToolWindow.Tab id={'table'} title={'Style'}>
          <ToolWindow.TabContent>
            <Accordion.Root type="multiple" defaultValue={['custom', 'dimensions', 'stroke']}>
              <NodeTableToolbarPanel />
              <div style={{ marginTop: '8px' }}>
                <ElementStylesheetPanel type={'node'} />
              </div>

              <NodeTablePropertiesPanel />
              <NodeTableDimensionsPanel />
              <NodeTableStrokePanel />
            </Accordion.Root>
          </ToolWindow.TabContent>
        </ToolWindow.Tab>
      )}
      {tabs.includes('cell') && (
        <ToolWindow.Tab id={'cell'} title={'Style'}>
          <ToolWindow.TabContent>
            <Accordion.Root type="multiple" defaultValue={['fill', 'dimensions']}>
              <NodeTableToolbarPanel />
              <ElementStylesheetPanel type={'node'} />

              <NodeFillPanel />
              <NodeTableCellDimensionsPanel />
            </Accordion.Root>
          </ToolWindow.TabContent>
        </ToolWindow.Tab>
      )}
      {tabs.includes('text') && (
        <ToolWindow.Tab id={'text'} title={'Text'}>
          <ToolWindow.TabContent>
            <Accordion.Root type="multiple" disabled={true} defaultValue={['text', 'label-node']}>
              <ElementStylesheetPanel type={'text'} />
              <NodeTextPanel />
            </Accordion.Root>
          </ToolWindow.TabContent>
        </ToolWindow.Tab>
      )}
      {tabs.includes('arrange') && (
        <ToolWindow.Tab id={'arrange'} title={'Arrange'}>
          <ToolWindow.TabContent>
            <Accordion.Root disabled={true} type="multiple" defaultValue={['transform']}>
              <ElementTransformPanel />
            </Accordion.Root>
          </ToolWindow.TabContent>
        </ToolWindow.Tab>
      )}
      {tabs.includes('advanced') && (
        <ToolWindow.Tab id={'advanced'} title={'Advanced'}>
          <ToolWindow.TabContent>
            <Accordion.Root type="multiple" defaultValue={['anchors', 'action-props']}>
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
          </ToolWindow.TabContent>
        </ToolWindow.Tab>
      )}
    </ToolWindow.Root>
  );
};
