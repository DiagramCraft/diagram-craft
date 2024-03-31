import React, { useEffect, useState } from 'react';
import { useEventListener } from '../hooks/useEventListener.ts';
import { useRedraw } from '../../react-canvas-viewer/useRedraw.tsx';
import { NumberInput } from '../components/NumberInput.tsx';
import { DiagramNode } from '../../model/diagramNode.ts';
import { ToolWindowPanel } from '../ToolWindowPanel.tsx';
import { useDiagram } from '../context/DiagramContext.ts';
import { UnitOfWork } from '../../model/unitOfWork.ts';
import { Select } from '../components/Select.tsx';

export const CustomPropertiesPanel = (props: Props) => {
  const diagram = useDiagram();
  const [node, setNode] = useState<DiagramNode | undefined>(undefined);
  const redraw = useRedraw();

  useEffect(() => {
    const callback = () => {
      const selectionType = diagram.selectionState.getSelectionType();
      if (selectionType !== 'single-node' && selectionType !== 'single-label-node') {
        setNode(undefined);
      } else {
        setNode(diagram.selectionState.nodes[0]);
      }
    };
    callback();

    diagram.selectionState.on('change', callback);
    return () => {
      diagram.selectionState.off('change', callback);
    };
  }, [diagram.selectionState]);

  useEventListener(diagram, 'elementChange', redraw);

  if (!node) {
    return <div></div>;
  }

  const def = diagram.nodeDefinitions.get(node.nodeType)!;
  const customProperties = def.getCustomProperties(node);
  if (Object.keys(customProperties).length === 0) {
    return <div></div>;
  }

  return (
    <ToolWindowPanel mode={props.mode ?? 'accordion'} title={def.name} id={'custom'}>
      <div className={'cmp-labeled-table'}>
        {Object.entries(customProperties).map(([key, value]) => {
          if (value.type === 'number') {
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
                      UnitOfWork.execute(diagram, uow => value.onChange(ev ?? 0, uow));
                    }}
                  />
                </div>
              </React.Fragment>
            );
          } else if (value.type === 'boolean') {
            return (
              <React.Fragment key={key}>
                <div className={'cmp-labeled-table__label'}>{value.label}:</div>
                <div className={'cmp-labeled-table__value'}>
                  <input
                    type="checkbox"
                    checked={value.value}
                    onChange={() => {
                      UnitOfWork.execute(diagram, uow => value.onChange(!value.value, uow));
                    }}
                  />
                </div>
              </React.Fragment>
            );
          } else if (value.type === 'select') {
            return (
              <React.Fragment key={key}>
                <div className={'cmp-labeled-table__label'}>{value.label}:</div>
                <div className={'cmp-labeled-table__value'}>
                  <Select
                    onValueChange={v => {
                      UnitOfWork.execute(diagram, uow => value.onChange(v, uow));
                    }}
                    value={value.value}
                    values={value.options.map(o => ({ value: o.value, label: o.label }))}
                  />
                </div>
              </React.Fragment>
            );
          }
        })}
      </div>
    </ToolWindowPanel>
  );
};

type Props = {
  mode?: 'accordion' | 'panel';
};
