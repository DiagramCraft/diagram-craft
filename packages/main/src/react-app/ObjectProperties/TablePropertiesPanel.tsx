import React from 'react';
import { useEventListener } from '../hooks/useEventListener';
import { useRedraw } from '../useRedraw';
import { NumberInput } from '../components/NumberInput';
import { ToolWindowPanel } from '../ToolWindowPanel';
import { useDiagram } from '../context/DiagramContext';
import { Select } from '../components/Select';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import {
  CustomPropertyDefinition,
  EdgeDefinition,
  NodeDefinition
} from '@diagram-craft/model/elementDefinitionRegistry';
import { useTable } from './useTable';

export const TablePropertiesPanel = (props: Props) => {
  const diagram = useDiagram();
  const redraw = useRedraw();
  const element = useTable(diagram);

  useEventListener(diagram, 'elementChange', redraw);

  if (!element) {
    return <div></div>;
  }

  const def: EdgeDefinition | NodeDefinition = element.getDefinition();
  const customProperties: Array<CustomPropertyDefinition> = def.getCustomProperties(element);

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
