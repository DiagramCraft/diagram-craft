import { ToolWindowPanel } from '../ToolWindowPanel';
import { useNodeProperty } from '../../hooks/useProperty';
import { PropertyEditor } from '../../components/PropertyEditor';
import { Property } from '../ObjectToolWindow/types';
import { useDiagram } from '../../../application';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { Select } from '@diagram-craft/app-components/Select';

type FormProps = {
  type: Property<'url' | 'diagram' | 'layer' | 'none'>;
  url: Property<string>;
};

export const NodeActionPropertiesPanelForm = ({ type, url }: FormProps) => {
  return (
    <div className={'cmp-labeled-table'}>
      <div className={'cmp-labeled-table__label'}>Type:</div>
      <div className={'cmp-labeled-table__value'}>
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
            </Select.Root>
          )}
        />
      </div>

      {type.val === 'url' && (
        <>
          <div className={'cmp-labeled-table__label'}>URL:</div>
          <div className={'cmp-labeled-table__value'}>
            <PropertyEditor property={url} render={props => <TextInput {...props} />} />
          </div>
        </>
      )}
    </div>
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
