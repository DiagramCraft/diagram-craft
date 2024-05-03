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

export const ObjectToolWindow = () => {
  const diagram = useDiagram();

  const [type, setType] = useState('none');
  const [edgeSupportsFill, setEdgeSupportsFill] = useState(false);

  const callback = () => {
    if (diagram.selectionState.getSelectionType() === 'mixed') {
      setType('mixed');
    } else if (diagram.selectionState.getSelectionType() === 'single-label-node') {
      setType('single-label-node');
    } else if (diagram.selectionState.isNodesOnly()) {
      setType('node');
    } else if (diagram.selectionState.isEdgesOnly()) {
      setType('edge');
    } else {
      setType('none');
    }

    setEdgeSupportsFill(
      diagram.selectionState.isEdgesOnly() &&
        diagram.selectionState.edges.every(e => e.getDefinition().supports('fill'))
    );
  };
  useEventListener(diagram.selectionState, 'change', callback);
  useEffect(callback, [diagram.selectionState]);

  return (
    <>
      <Accordion.Root
        className="cmp-accordion"
        type="multiple"
        defaultValue={[
          'stylesheet',
          'fill',
          'stroke',
          'line',
          'text',
          'snap',
          'grid',
          'canvas',
          'snap',
          'custom',
          'label-node'
        ]}
      >
        {type === 'node' && <StylesheetPanel />}
        {(type === 'node' || type === 'mixed' || type === 'single-label-node') && (
          <>
            <NodeFillPanel />
            <ShadowPanel />
            <NodeStrokePanel />
            <TextPanel />
            {type !== 'single-label-node' && <TransformPanel />}
            {type === 'single-label-node' && <LabelNodePanel />}
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
          </>
        )}

        {type === 'none' && (
          <>
            <CanvasPanel />
            <CanvasGridPanel />
            <CanvasGuidesProperties />
            <CanvasSnapPanel />
          </>
        )}
      </Accordion.Root>
    </>
  );
};
