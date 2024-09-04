import React, { useEffect, useState } from 'react';
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
import { useDiagram } from '../../context/DiagramContext';
import { useRedraw } from '../../hooks/useRedraw';
import { useEventListener } from '../../hooks/useEventListener';
import { ToolWindowPanel } from '../ToolWindowPanel';
import { NumberInput } from '@diagram-craft/app-components/NumberInput';
import { Select } from '@diagram-craft/app-components/Select';
import { Checkbox } from '@diagram-craft/app-components/Checkbox';

export const ElementCustomPropertiesPanel = (props: Props) => {
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
  let customProperties: ReadonlyArray<CustomPropertyDefinition>;

  if (element instanceof DiagramNode) {
    def = element.getDefinition();
    customProperties = def.getCustomPropertyDefinitions(element);
  } else if (element instanceof DiagramEdge) {
    def = element.getDefinition();
    customProperties = def.getCustomPropertyDefinitions(element);
  } else {
    throw new VerifyNotReached();
  }

  if (Object.keys(customProperties).length === 0) {
    return <div></div>;
  }

  return (
    <ToolWindowPanel mode={props.mode ?? 'accordion'} title={def.name} id={'custom'}>
      <div className={'cmp-labeled-table cmp-labeled-table--wide'}>
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
                    defaultValue={value.defaultValue}
                    isDefaultValue={!value.isSet}
                    min={value.minValue ?? 0}
                    max={value.maxValue ?? 100}
                    step={value.step ?? 1}
                    style={{ width: '50px' }}
                    onChange={ev => {
                      const uow = new UnitOfWork(diagram, true);
                      value.onChange(ev, uow);
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
                  <Checkbox
                    value={value.value}
                    onChange={b => {
                      const uow = new UnitOfWork(diagram, true);
                      value.onChange(b, uow);
                      commitWithUndo(uow, `Change ${value.label}`);
                    }}
                    defaultValue={value.defaultValue}
                    isDefaultValue={!value.isSet}
                  />
                </div>
              </React.Fragment>
            );
          } else if (value.type === 'select') {
            return (
              <React.Fragment key={key}>
                <div className={'cmp-labeled-table__label'}>{value.label}:</div>
                <div className={'cmp-labeled-table__value'}>
                  <Select.Root
                    onValueChange={v => {
                      const uow = new UnitOfWork(diagram, true);
                      value.onChange(v, uow);
                      commitWithUndo(uow, `Change ${value.label}`);
                    }}
                    value={value.value}
                    defaultValue={value.defaultValue}
                    isDefaultValue={value.isSet}
                  >
                    {value.options.map(o => (
                      <Select.Item key={o.value} value={o.value}>
                        {o.label}
                      </Select.Item>
                    ))}
                  </Select.Root>
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
