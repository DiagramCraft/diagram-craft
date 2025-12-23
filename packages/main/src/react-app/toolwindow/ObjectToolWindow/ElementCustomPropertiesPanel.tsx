import React, { useEffect, useState } from 'react';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { DiagramElement, isEdge, isNode } from '@diagram-craft/model/diagramElement';
import {
  asProperty,
  CustomPropertyDefinition,
  NodeDefinition
} from '@diagram-craft/model/elementDefinitionRegistry';
import { VerifyNotReached } from '@diagram-craft/utils/assert';
import { commitWithUndo } from '@diagram-craft/model/diagramUndoActions';
import { useRedraw } from '../../hooks/useRedraw';
import { useEventListener } from '../../hooks/useEventListener';
import { ToolWindowPanel } from '../ToolWindowPanel';
import { NumberInput } from '@diagram-craft/app-components/NumberInput';
import { Select } from '@diagram-craft/app-components/Select';
import { Checkbox } from '@diagram-craft/app-components/Checkbox';
import { PropertyEditor } from '../../components/PropertyEditor';
import { useDiagram } from '../../../application';
import type { Property } from '@diagram-craft/model/property';
import type { EdgeDefinition } from '@diagram-craft/model/edgeDefinition';

export const ElementCustomPropertiesPanelForm = ({
  customProperties,
  onChange
}: {
  element: DiagramElement;
  customProperties: readonly CustomPropertyDefinition[];
  onChange: (value: CustomPropertyDefinition) => (cb: (uow: UnitOfWork) => void) => void;
}) => {
  return (
    <div className={'cmp-labeled-table cmp-labeled-table--wide'}>
      {Object.entries(customProperties).map(([key, value]) => {
        const prop = asProperty(value, onChange(value));

        if (value.type === 'number') {
          return (
            <React.Fragment key={key}>
              <div className={'cmp-labeled-table__label'}>{value.label}:</div>
              <div className={'cmp-labeled-table__value'}>
                {/* biome-ignore lint/suspicious/noExplicitAny: false positive */}
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
                {/* biome-ignore lint/suspicious/noExplicitAny: false positive */}
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
        } else if (value.type === 'delimiter') {
          return (
            <React.Fragment key={key}>
              <div className={'cmp-labeled-table__label'} style={{ marginTop: '0.5rem' }}>
                <b>{value.label}:</b>
              </div>
              <div className={'cmp-labeled-table__value'}></div>
            </React.Fragment>
          );
        }
      })}
    </div>
  );
};

export const ElementCustomPropertiesPanel = (props: Props) => {
  const diagram = useDiagram();
  const [element, setElement] = useState<DiagramElement | undefined>(undefined);
  const redraw = useRedraw();

  useEffect(() => {
    const callback = () => {
      const selectionType = diagram.selection.type;
      if (
        selectionType !== 'single-node' &&
        selectionType !== 'single-label-node' &&
        selectionType !== 'single-edge'
      ) {
        setElement(undefined);
      } else {
        setElement(diagram.selection.elements[0]);
      }
    };
    callback();

    diagram.selection.on('change', callback);
    return () => {
      diagram.selection.off('change', callback);
    };
  }, [diagram.selection]);

  useEventListener(diagram, 'elementChange', redraw);

  if (!element) {
    return <div></div>;
  }

  let def: EdgeDefinition | NodeDefinition;
  let customProperties: ReadonlyArray<CustomPropertyDefinition>;

  if (isNode(element)) {
    def = element.getDefinition();
    customProperties = def.getCustomPropertyDefinitions(element);
  } else if (isEdge(element)) {
    def = element.getDefinition();
    customProperties = def.getCustomPropertyDefinitions(element);
  } else {
    throw new VerifyNotReached();
  }

  if (Object.keys(customProperties).length === 0) {
    return <div></div>;
  }

  const onChange = (value: CustomPropertyDefinition) => (cb: (uow: UnitOfWork) => void) => {
    const uow = new UnitOfWork(diagram, true);
    cb(uow);
    commitWithUndo(uow, `Change ${value.label}`);
  };

  return (
    <ToolWindowPanel mode={props.mode ?? 'accordion'} title={def.name} id={'custom'}>
      <ElementCustomPropertiesPanelForm
        element={element}
        customProperties={customProperties}
        onChange={onChange}
      />
    </ToolWindowPanel>
  );
};

type Props = {
  mode?: 'accordion' | 'panel';
};
