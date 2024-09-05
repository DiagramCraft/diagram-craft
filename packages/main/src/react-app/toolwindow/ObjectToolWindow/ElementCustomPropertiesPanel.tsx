import React, { useEffect, useState } from 'react';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { DiagramElement } from '@diagram-craft/model/diagramElement';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { DiagramEdge } from '@diagram-craft/model/diagramEdge';
import {
  asProperty,
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
import { PropertyEditor } from '../../components/PropertyEditor';
import { Property } from './types';

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
