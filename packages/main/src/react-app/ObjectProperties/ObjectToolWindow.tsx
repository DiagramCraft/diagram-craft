import { useEffect, useState } from 'react';
import { useEventListener } from '../hooks/useEventListener';
import * as Accordion from '@radix-ui/react-accordion';
import { EdgeLinePanel } from './EdgeLinePanel';
import { NodeFillPanel } from './NodeFillPanel';
import { TextPanel } from './TextPanel';
import { TransformPanel } from './TransformPanel';
import { CustomPropertiesPanel } from './CustomPropertiesPanel';
import { ShadowPanel } from './ShadowPanel';
import { CanvasPanel } from './CanvasPanel';
import { CanvasGuidesProperties } from './CanvasGuidesProperties';
import { CanvasGridPanel } from './CanvasGridPanel';
import { CanvasSnapPanel } from './CanvasSnapPanel';
import { NodeStrokePanel } from './NodeStrokePanel';
import { useDiagram } from '../context/DiagramContext';
import { LabelNodePanel } from './LabelNodePanel';
import { NodeEffectsPanel } from './NodeEffectsPanel';
import { StylesheetPanel } from './StylesheetPanel';
import { EdgeEffectsPanel } from './EdgeEffectsPanel';
import * as Tabs from '@radix-ui/react-tabs';
import { $c } from '@diagram-craft/utils/classname';
import { TablePropertiesPanel } from './TablePropertiesPanel';
import { TableStrokePanel } from './TableStrokePanel';
import { TableDimensionsPanel } from './TableDimensionsPanel';
import { TableCellDimensionsPanel } from './TableCellDimensionsPanel';

type Type = 'diagram' | 'mixed' | 'single-label-node' | 'node' | 'edge' | 'table' | 'table-cell';

const TABS: Record<Type, string[]> = {
  'diagram': ['diagram'],
  'node': ['style', 'text', 'arrange'],
  'edge': ['style'],
  'mixed': ['style', 'text', 'arrange'],
  'single-label-node': ['style', 'text'],
  'table': ['table'],
  'table-cell': ['table', 'cell', 'text']
};

export const ObjectToolWindow = () => {
  const diagram = useDiagram();

  const [type, setType] = useState<Type>('diagram');
  const [tab, setTab] = useState('main');
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
      diagram.selectionState.nodes.every(e => e.parent?.nodeType === 'tableRow')
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

  const tabs = TABS[type];

  return (
    <>
      <div className={'cmp-tool-tabs'}>
        <Tabs.Root value={tab} onValueChange={e => setTab(e)}>
          <Tabs.List className={$c('cmp-tool-tabs__tabs', { hidden: tabs.length <= 1 })}>
            {tabs.includes('diagram') && (
              <Tabs.Trigger className="cmp-tool-tabs__tab-trigger util-vcenter" value={'diagram'}>
                Diagram
              </Tabs.Trigger>
            )}
            {tabs.includes('style') && (
              <Tabs.Trigger className="cmp-tool-tabs__tab-trigger util-vcenter" value={'style'}>
                Style
              </Tabs.Trigger>
            )}
            {tabs.includes('table') && (
              <Tabs.Trigger className="cmp-tool-tabs__tab-trigger util-vcenter" value={'table'}>
                Table
              </Tabs.Trigger>
            )}
            {tabs.includes('cell') && (
              <Tabs.Trigger className="cmp-tool-tabs__tab-trigger util-vcenter" value={'cell'}>
                Cell
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
          </Tabs.List>

          {(type === 'table' || type === 'table-cell') && (
            <Tabs.Content value={'table'}>
              <Accordion.Root
                className="cmp-accordion"
                type="multiple"
                defaultValue={['custom', 'dimensions', 'stroke']}
              >
                <TablePropertiesPanel />
                <TableDimensionsPanel />
                <TableStrokePanel />
              </Accordion.Root>
            </Tabs.Content>
          )}
          {type === 'table-cell' && (
            <Tabs.Content value={'cell'}>
              <Accordion.Root
                className="cmp-accordion"
                type="multiple"
                defaultValue={['fill', 'dimensions']}
              >
                <NodeFillPanel />
                <TableCellDimensionsPanel />
              </Accordion.Root>
            </Tabs.Content>
          )}

          {type === 'diagram' && (
            <Tabs.Content value={'diagram'}>
              <Accordion.Root
                className="cmp-accordion"
                type="multiple"
                defaultValue={['grid', 'canvas', 'snap']}
              >
                <CanvasPanel />
                <CanvasGridPanel />
                <CanvasGuidesProperties />
                <CanvasSnapPanel />
              </Accordion.Root>
            </Tabs.Content>
          )}

          <Tabs.Content value={'arrange'}>
            <Accordion.Root className="cmp-accordion" type="multiple" defaultValue={['transform']}>
              <TransformPanel />
            </Accordion.Root>
          </Tabs.Content>

          <Tabs.Content value={'text'}>
            <Accordion.Root
              className="cmp-accordion"
              type="multiple"
              defaultValue={['text', 'label-node']}
            >
              <TextPanel />
              {type === 'single-label-node' && <LabelNodePanel />}
            </Accordion.Root>
          </Tabs.Content>

          <Tabs.Content value={'style'}>
            <Accordion.Root
              className="cmp-accordion"
              type="multiple"
              defaultValue={['stylesheet', 'fill', 'stroke', 'line', 'custom']}
            >
              {type === 'node' && <StylesheetPanel />}

              {(type === 'node' || type === 'mixed' || type === 'single-label-node') && (
                <>
                  <NodeFillPanel />
                  <ShadowPanel />
                  <NodeStrokePanel />
                  <NodeEffectsPanel />
                  <CustomPropertiesPanel />
                </>
              )}

              {type === 'edge' && (
                <>
                  <StylesheetPanel />
                  {edgeSupportsFill && <NodeFillPanel />}
                  <EdgeLinePanel />
                  <ShadowPanel />
                  <EdgeEffectsPanel />
                  <CustomPropertiesPanel />
                </>
              )}
            </Accordion.Root>
          </Tabs.Content>
        </Tabs.Root>
      </div>
    </>
  );
};
