import React, { useEffect, useState } from 'react';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { DiagramElement, isEdge, isNode } from '@diagram-craft/model/diagramElement';
import {
  asProperty,
  CustomPropertyDefinition,
  CustomPropertyType,
  NodeDefinition
} from '@diagram-craft/model/elementDefinitionRegistry';
import { VerifyNotReached } from '@diagram-craft/utils/assert';
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
import { DataFields } from '../ObjectDataToolWindow/DataFields';

const CustomPropertyList = (props: {
  customProperties: CustomPropertyDefinition;
  onChange: (value: CustomPropertyType) => (cb: (uow: UnitOfWork) => void) => void;
}) => {
  return Object.entries(props.customProperties.entries).map(([key, value]) => {
    if (value.type === 'delimiter') {
      return (
        <React.Fragment key={key}>
          <dt style={{ marginTop: '0.5rem' }}>
            <b>{value.label}:</b>
          </dt>
          <dd></dd>
        </React.Fragment>
      );
    } else {
      const prop = asProperty(value, props.onChange(value));

      if (value.type === 'number') {
        return (
          <React.Fragment key={key}>
            <dt>{value.label}:</dt>
            <dd data-type={value.type} data-label={value.label}>
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
            </dd>
          </React.Fragment>
        );
      } else if (value.type === 'boolean') {
        return (
          <React.Fragment key={key}>
            <dt>{value.label}:</dt>
            <dd data-type={value.type} data-label={value.label}>
              {/* biome-ignore lint/suspicious/noExplicitAny: false positive */}
              <PropertyEditor<any> property={prop} render={props => <Checkbox {...props} />} />
            </dd>
          </React.Fragment>
        );
      } else if (value.type === 'select') {
        return (
          <React.Fragment key={key}>
            <dt>{value.label}:</dt>
            <dd data-type={value.type} data-label={value.label}>
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
            </dd>
          </React.Fragment>
        );
      }
    }
  });
};

export const ElementCustomPropertiesPanelForm = ({
  customProperties,
  onChange
}: {
  element: DiagramElement;
  customProperties: CustomPropertyDefinition;
  onChange: (value: CustomPropertyType) => (cb: (uow: UnitOfWork) => void) => void;
}) => {
  return (
    <>
      {customProperties.dataSchemas.length === 0 && (
        <div className={'cmp-labeled-table cmp-labeled-table--wide'}>
          <CustomPropertyList customProperties={customProperties} onChange={onChange} />
        </div>
      )}
      {customProperties.dataSchemas.length > 0 && (
        <>
          {customProperties.entries.length > 0 && (
            <>
              <div style={{ color: 'var(--panel-fg)', marginBottom: '-1.05rem' }}>Style:</div>

              <div className={'cmp-labeled-table cmp-labeled-table--inline'}>
                <CustomPropertyList customProperties={customProperties} onChange={onChange} />
              </div>
            </>
          )}

          {customProperties.dataSchemas.map(schema => (
            <React.Fragment key={schema.id}>
              <div
                style={{ color: 'var(--panel-fg)', marginBottom: '-1.05rem', marginTop: '1rem' }}
              >
                Data:
              </div>
              <div className={'cmp-labeled-table cmp-labeled-table--inline'}>
                <DataFields key={schema.id} schema={schema} />
              </div>
            </React.Fragment>
          ))}
        </>
      )}
    </>
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
  let customProperties: CustomPropertyDefinition;

  if (isNode(element)) {
    def = element.getDefinition();
    customProperties = def.getCustomPropertyDefinitions(element);
  } else if (isEdge(element)) {
    def = element.getDefinition();
    customProperties = def.getCustomPropertyDefinitions(element);
  } else {
    throw new VerifyNotReached();
  }

  if (customProperties.entries.length === 0 && customProperties.dataSchemas.length === 0) {
    return <div></div>;
  }

  const onChange = (value: CustomPropertyType) => (cb: (uow: UnitOfWork) => void) => {
    UnitOfWork.executeWithUndo(diagram, `Change ${value.label}`, cb);
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
