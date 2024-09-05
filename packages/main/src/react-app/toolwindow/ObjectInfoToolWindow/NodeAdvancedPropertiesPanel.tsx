import { ToolWindowPanel } from '../ToolWindowPanel';
import { useNodeProperty } from '../../hooks/useProperty';
import { useDiagram } from '../../context/DiagramContext';
import { Checkbox } from '@diagram-craft/app-components/Checkbox';
import { PropertyEditor } from '../../components/PropertyEditor';

export const NodeAdvancedPropertiesPanel = (props: Props) => {
  const diagram = useDiagram();
  const resizableH = useNodeProperty(diagram, 'capabilities.resizable.horizontal');
  const resizableV = useNodeProperty(diagram, 'capabilities.resizable.vertical');
  const movable = useNodeProperty(diagram, 'capabilities.movable');
  const editable = useNodeProperty(diagram, 'capabilities.editable');
  const deletable = useNodeProperty(diagram, 'capabilities.deletable');
  const rotatable = useNodeProperty(diagram, 'capabilities.rotatable');
  const inheritStyle = useNodeProperty(diagram, 'inheritStyle');

  return (
    <ToolWindowPanel
      mode={props.mode ?? 'accordion'}
      id="advanced-props"
      title={'Advanced Properties'}
      hasCheckbox={false}
    >
      <div className={'cmp-labeled-table cmp-labeled-table--wide'}>
        <div className={'cmp-labeled-table__label'}>Resize Horizontally:</div>
        <div className={'cmp-labeled-table__value'}>
          <PropertyEditor property={resizableH} render={props => <Checkbox {...props} />} />
        </div>

        <div className={'cmp-labeled-table__label'}>Resize Vertically:</div>
        <div className={'cmp-labeled-table__value'}>
          <PropertyEditor property={resizableV} render={props => <Checkbox {...props} />} />
        </div>

        <div className={'cmp-labeled-table__label'}>Movable:</div>
        <div className={'cmp-labeled-table__value'}>
          <PropertyEditor property={movable} render={props => <Checkbox {...props} />} />
        </div>

        <div className={'cmp-labeled-table__label'}>Rotatable:</div>
        <div className={'cmp-labeled-table__value'}>
          <PropertyEditor property={rotatable} render={props => <Checkbox {...props} />} />
        </div>

        <div className={'cmp-labeled-table__label'}>Editable:</div>
        <div className={'cmp-labeled-table__value'}>
          <PropertyEditor property={editable} render={props => <Checkbox {...props} />} />
        </div>

        <div className={'cmp-labeled-table__label'}>Deletable:</div>
        <div className={'cmp-labeled-table__value'}>
          <PropertyEditor property={deletable} render={props => <Checkbox {...props} />} />
        </div>

        <div className={'cmp-labeled-table__label'}>Inherit Style:</div>
        <div className={'cmp-labeled-table__value'}>
          <PropertyEditor property={inheritStyle} render={props => <Checkbox {...props} />} />
        </div>
      </div>
    </ToolWindowPanel>
  );
};

type Props = {
  mode?: 'accordion' | 'panel';
};
