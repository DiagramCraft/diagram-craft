import { ToolWindowPanel } from '../ToolWindowPanel';
import { useNodeProperty } from '../../hooks/useProperty';
import { useDiagram } from '../../context/DiagramContext';
import { Checkbox } from '@diagram-craft/app-components/Checkbox';

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
          <Checkbox
            value={resizableH.val}
            onChange={b => resizableH.set(b)}
            defaultValue={resizableH.defaultVal}
            isDefaultValue={resizableH.isDefaultVal()}
          />
        </div>

        <div className={'cmp-labeled-table__label'}>Resize Vertically:</div>
        <div className={'cmp-labeled-table__value'}>
          <Checkbox
            value={resizableV.val}
            onChange={b => resizableV.set(b)}
            defaultValue={resizableV.defaultVal}
            isDefaultValue={resizableV.isDefaultVal()}
          />
        </div>

        <div className={'cmp-labeled-table__label'}>Movable:</div>
        <div className={'cmp-labeled-table__value'}>
          <Checkbox
            value={movable.val}
            onChange={b => movable.set(b)}
            defaultValue={movable.defaultVal}
            isDefaultValue={movable.isDefaultVal()}
          />
        </div>

        <div className={'cmp-labeled-table__label'}>Rotatable:</div>
        <div className={'cmp-labeled-table__value'}>
          <Checkbox
            value={rotatable.val}
            onChange={b => rotatable.set(b)}
            defaultValue={rotatable.defaultVal}
            isDefaultValue={rotatable.isDefaultVal()}
          />
        </div>

        <div className={'cmp-labeled-table__label'}>Editable:</div>
        <div className={'cmp-labeled-table__value'}>
          <Checkbox
            value={editable.val}
            onChange={b => editable.set(b)}
            defaultValue={editable.defaultVal}
            isDefaultValue={editable.isDefaultVal()}
          />
        </div>

        <div className={'cmp-labeled-table__label'}>Deletable:</div>
        <div className={'cmp-labeled-table__value'}>
          <Checkbox
            value={deletable.val}
            onChange={b => deletable.set(b)}
            defaultValue={deletable.defaultVal}
            isDefaultValue={deletable.isDefaultVal()}
          />
        </div>

        <div className={'cmp-labeled-table__label'}>Inherit Style:</div>
        <div className={'cmp-labeled-table__value'}>
          <Checkbox
            value={inheritStyle.val}
            onChange={b => inheritStyle.set(b)}
            defaultValue={inheritStyle.defaultVal}
            isDefaultValue={inheritStyle.isDefaultVal()}
          />
        </div>
      </div>
    </ToolWindowPanel>
  );
};

type Props = {
  mode?: 'accordion' | 'panel';
};
