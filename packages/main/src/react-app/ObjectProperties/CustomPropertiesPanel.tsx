import React, { useEffect, useState } from 'react';
import { useEventListener } from '../hooks/useEventListener';
import { useRedraw } from '../useRedraw';
import { NumberInput } from '../components/NumberInput';
import { ToolWindowPanel } from '../ToolWindowPanel';
import { useDiagram } from '../context/DiagramContext';
import { Select } from '../components/Select';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { DiagramElement } from '@diagram-craft/model/diagramElement';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { DiagramEdge } from '@diagram-craft/model/diagramEdge';
import {
  CustomPropertyDefinition,
  EdgeDefinition,
  NodeDefinition
} from '@diagram-craft/model/elementDefinitionRegistry';
import { VerifyNotReached } from '@diagram-craft/utils/assert';
import { commitWithUndo } from '@diagram-craft/model/diagramUndoActions';

export const CustomPropertiesPanel = (props: Props) => {
  const diagram = useDiagram();
  const [element, setElement] = useState<DiagramElement | undefined>(undefined);
  const redraw = useRedraw();

  useEffect(() => {
    const callback = () => {
      const selectionType = diagram.selectionState.getSelectionType();
      if (
        selectionType !== 'single-node' &&
        selectionType !== 'single-label-node' &&
        selectionType !== 'single-edge'
      ) {
        setElement(undefined);
      } else {
        setElement(diagram.selectionState.elements[0]);
      }
    };
    callback();

    diagram.selectionState.on('change', callback);
    return () => {
      diagram.selectionState.off('change', callback);
    };
  }, [diagram.selectionState]);

  useEventListener(diagram, 'elementChange', redraw);

  if (!element) {
    return <div></div>;
  }

  let def: EdgeDefinition | NodeDefinition;
  let customProperties: Array<CustomPropertyDefinition>;

  if (element instanceof DiagramNode) {
    def = element.getDefinition();
    customProperties = def.getCustomProperties(element);
  } else if (element instanceof DiagramEdge) {
    def = element.getDefinition();
    customProperties = def.getCustomProperties(element);
  } else {
    throw new VerifyNotReached();
  }

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
                      const uow = new UnitOfWork(diagram, true);
                      value.onChange(ev ?? 0, uow);
                      commitWithUndo(uow, `Change ${value.label}`);
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
                      const uow = new UnitOfWork(diagram, true);
                      value.onChange(!value.value, uow);
                      commitWithUndo(uow, `Change ${value.label}`);
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
                      const uow = new UnitOfWork(diagram, true);
                      value.onChange(v, uow);
                      commitWithUndo(uow, `Change ${value.label}`);
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
