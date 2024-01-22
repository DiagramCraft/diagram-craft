import { useEffect, useState } from 'react';
import { useEventListener } from '../hooks/useEventListener.ts';
import * as Accordion from '@radix-ui/react-accordion';
import { LinePanel } from './LinePanel.tsx';
import { NodeFillPanel } from './NodeFillPanel.tsx';
import { TextPanel } from './TextPanel.tsx';
import { TransformPanel } from './TransformPanel.tsx';
import { CustomPropertiesPanel } from './CustomPropertiesPanel.tsx';
import { ShadowPanel } from './ShadowPanel.tsx';
import { CanvasPanel } from './CanvasPanel.tsx';
import { CanvasGuidesProperties } from './CanvasGuidesProperties.tsx';
import { CanvasGridPanel } from './CanvasGridPanel.tsx';
import { CanvasSnapPanel } from './CanvasSnapPanel.tsx';
import { NodeStrokePanel } from './NodeStrokePanel.tsx';
import { useDiagram } from '../context/DiagramContext.tsx';
import { LabelNodePanel } from './LabelNodePanel.tsx';
import { NodeEffectsPanel } from './NodeEffectsPanel.tsx';
import { StylesheetPanel } from './StylesheetPanel.tsx';

export const ObjectToolWindow = () => {
  const diagram = useDiagram();

  const [type, setType] = useState('none');

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
            <LinePanel />
            <ShadowPanel />
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
