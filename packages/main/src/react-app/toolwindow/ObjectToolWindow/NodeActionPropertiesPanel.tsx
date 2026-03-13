import { ToolWindowPanel } from '../ToolWindowPanel';
import { useNodeProperty } from '../../hooks/useProperty';
import { PropertyEditor } from '../../components/PropertyEditor';
import { useDiagram, useDocument } from '../../../application';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { Select } from '@diagram-craft/app-components/Select';
import { coalesce } from '@diagram-craft/utils/strings';
import { Diagram } from '@diagram-craft/model/diagram';
import React from 'react';
import type { Property } from '@diagram-craft/model/property';
import { KeyValueTable } from '@diagram-craft/app-components/KeyValueTable';

const DiagramList = (props: { list: readonly Diagram[]; level: number }) => {
  return (
    <>
      {props.list.map(diagram => {
        return (
          <React.Fragment key={diagram.id}>
            <Select.Item value={diagram.id}>
              <span style={{ width: `${props.level * 10}px`, display: 'inline-block' }} />
              {diagram.name}
            </Select.Item>
            <DiagramList list={diagram.diagrams} level={props.level + 1} />
          </React.Fragment>
        );
      })}
    </>
  );
};

type FormProps = {
  type: Property<'url' | 'diagram' | 'layer' | 'none'>;
  url: Property<string>;
};

export const NodeActionPropertiesPanelForm = ({ type, url }: FormProps) => {
  const document = useDocument();
  const diagram = useDiagram();

  return (
    <KeyValueTable.Root>
      <KeyValueTable.Label>Type:</KeyValueTable.Label>
      <KeyValueTable.Value>
        <PropertyEditor
          property={type}
          render={props => (
            <Select.Root
              {...props}
              onChange={e => {
                type.set((e ?? 'none') as 'url' | 'diagram' | 'layer' | 'none');
              }}
            >
              <Select.Item value={'none'}>None</Select.Item>
              <Select.Item value={'url'}>URL</Select.Item>
              <Select.Item value={'diagram'}>Sheet</Select.Item>
              <Select.Item value={'layer'}>Toggle Layer</Select.Item>
            </Select.Root>
          )}
        />
      </KeyValueTable.Value>

      {type.val === 'url' && (
        <>
          <KeyValueTable.Label>URL:</KeyValueTable.Label>
          <KeyValueTable.Value>
            <PropertyEditor property={url} render={props => <TextInput {...props} />} />
          </KeyValueTable.Value>
        </>
      )}

      {type.val === 'diagram' && (
        <>
          <KeyValueTable.Label>Diagram:</KeyValueTable.Label>
          <KeyValueTable.Value>
            <PropertyEditor
              property={url}
              render={props => (
                <Select.Root {...props} value={coalesce(props.value, '')!} placeholder={'Select'}>
                  <DiagramList level={0} list={document.diagrams} />
                </Select.Root>
              )}
            />
          </KeyValueTable.Value>
        </>
      )}

      {type.val === 'layer' && (
        <>
          <KeyValueTable.Label>Layer:</KeyValueTable.Label>
          <KeyValueTable.Value>
            <PropertyEditor
              property={url}
              render={props => (
                <Select.Root {...props} value={diagram.activeLayer.id ?? ''} placeholder={'Select'}>
                  {diagram.layers.all.map(layer => (
                    <Select.Item key={layer.id} value={layer.id}>
                      {layer.name}
                    </Select.Item>
                  ))}
                </Select.Root>
              )}
            />
          </KeyValueTable.Value>
        </>
      )}
    </KeyValueTable.Root>
  );
};

export const NodeActionPropertiesPanel = (props: Props) => {
  const diagram = useDiagram();
  const type = useNodeProperty(diagram, 'action.type');
  const url = useNodeProperty(diagram, 'action.url');

  return (
    <ToolWindowPanel
      mode={props.mode ?? 'accordion'}
      id="action-props"
      title={'Action'}
      hasCheckbox={false}
    >
      <NodeActionPropertiesPanelForm type={type} url={url} />
    </ToolWindowPanel>
  );
};

type Props = {
  mode?: 'accordion' | 'panel';
};
