import { EditableDiagram } from '../../model-editor/editable-diagram.ts';
import React, { useEffect, useState } from 'react';
import { useEventListener } from '../hooks/useEventListener.ts';
import { useRedraw } from '../../react-canvas-viewer/useRedraw.tsx';
import { NumberInput } from '../NumberInput.tsx';
import { DiagramNode } from '../../model-viewer/diagramNode.ts';
import { ToolWindowPanel } from '../components/ToolWindowPanel.tsx';

export const CustomPropertiesPanel = (props: Props) => {
  const [node, setNode] = useState<DiagramNode | undefined>(undefined);
  const redraw = useRedraw();

  useEffect(() => {
    const callback = () => {
      if (
        props.diagram.selectionState.nodes.length !== 1 ||
        props.diagram.selectionState.edges.length !== 0
      ) {
        setNode(undefined);
      } else {
        setNode(props.diagram.selectionState.nodes[0]);
      }
    };
    callback();

    props.diagram.selectionState.on('change', callback);
    return () => {
      props.diagram.selectionState.off('change', callback);
    };
  }, [props.diagram.selectionState]);

  useEventListener(props.diagram, 'nodechanged', redraw);

  if (!node) {
    return <div></div>;
  }

  const def = props.diagram.nodeDefinitions.get(node.nodeType)!;
  const customProperties = def.getCustomProperties(node);
  if (Object.keys(customProperties).length === 0) {
    return <div></div>;
  }

  return (
    <ToolWindowPanel mode={props.mode ?? 'accordion'} title={def.name} id={'custom'}>
      <div className={'cmp-labeled-table'}>
        {Object.entries(customProperties).map(([key, value]) => {
          return (
            <React.Fragment key={key}>
              <div className={'cmp-labeled-table__label'}>{value.label}:</div>
              <div className={'cmp-labeled-table__value'}>
                <NumberInput
                  defaultUnit={value.unit ?? ''}
                  validUnits={value.unit ? [value.unit] : []}
                  value={value.value}
                  min={value.minValue ?? 0}
                  max={value.maxValue ?? 100}
                  step={value.step ?? 1}
                  style={{ width: '50px' }}
                  onChange={ev => {
                    value.onChange(ev ?? 0);
                    node?.commitChanges();
                  }}
                />
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </ToolWindowPanel>
  );
};

type Props = {
  diagram: EditableDiagram;
  mode?: 'accordion' | 'panel';
};
