import React from 'react';
import { useEventListener } from '../../hooks/useEventListener';
import { useRedraw } from '../../hooks/useRedraw';
import { NumberInput } from '@diagram-craft/app-components/NumberInput';
import { ToolWindowPanel } from '../ToolWindowPanel';
import { Select } from '@diagram-craft/app-components/Select';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import {
  asProperty,
  CustomPropertyDefinition,
  EdgeDefinition,
  NodeDefinition
} from '@diagram-craft/model/elementDefinitionRegistry';
import { useTable } from '../../hooks/useTable';
import { commitWithUndo } from '@diagram-craft/model/diagramUndoActions';
import { Checkbox } from '@diagram-craft/app-components/Checkbox';
import { PropertyEditor } from '../../components/PropertyEditor';
import { Property } from './types';
import { useDiagram } from '../../../application';

export const NodeTablePropertiesPanel = (props: Props) => {
  const diagram = useDiagram();
  const redraw = useRedraw();
  const element = useTable(diagram);

  useEventListener(diagram, 'elementChange', redraw);

  if (!element) {
    return <div></div>;
  }

  const def: EdgeDefinition | NodeDefinition = element.getDefinition();
  const customProperties: ReadonlyArray<CustomPropertyDefinition> =
    def.getCustomPropertyDefinitions(element);

  if (Object.keys(customProperties).length === 0) {
    return <div></div>;
  }

  return (
    <ToolWindowPanel mode={props.mode ?? 'accordion'} title={def.name} id={'custom'}>
      <div className={'cmp-labeled-table'}>
        {Object.entries(customProperties).map(([key, value]) => {
          const prop = asProperty(value, cb => {
            const uow = new UnitOfWork(diagram, true);
            cb(uow);
            commitWithUndo(uow, `Change ${value.label}`);
          });

          if (value.type === 'number') {
            return (
              <React.Fragment key={key}>
                <div className={'cmp-labeled-table__label'}>{value.label}:</div>
                <div className={'cmp-labeled-table__value'}>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  <PropertyEditor<any>
                    property={prop}
                    render={props => (
                      <NumberInput
                        {...props}
                        defaultUnit={value.unit ?? ''}
                        validUnits={value.unit ? [value.unit] : []}
                        min={value.minValue ?? 0}
                        max={value.maxValue ?? 100}
                        step={value.step ?? 1}
                        style={{ width: '50px' }}
                      />
                    )}
                  />
                </div>
              </React.Fragment>
            );
          } else if (value.type === 'boolean') {
            return (
              <React.Fragment key={key}>
                <div className={'cmp-labeled-table__label'}>{value.label}:</div>
                <div className={'cmp-labeled-table__value'}>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  <PropertyEditor<any> property={prop} render={props => <Checkbox {...props} />} />
                </div>
              </React.Fragment>
            );
          } else if (value.type === 'select') {
            return (
              <React.Fragment key={key}>
                <div className={'cmp-labeled-table__label'}>{value.label}:</div>
                <div className={'cmp-labeled-table__value'}>
                  <PropertyEditor
                    property={prop as Property<string>}
                    render={props => (
                      <Select.Root {...props}>
                        {value.options.map(o => (
                          <Select.Item key={o.value} value={o.value}>
                            {o.label}
                          </Select.Item>
                        ))}
                      </Select.Root>
                    )}
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
