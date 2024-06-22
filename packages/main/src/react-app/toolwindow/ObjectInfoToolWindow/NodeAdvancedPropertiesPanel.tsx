import { ToolWindowPanel } from '../ToolWindowPanel';
import { useNodeProperty } from '../../hooks/useProperty';
import { useDiagram } from '../../context/DiagramContext';

export const NodeAdvancedPropertiesPanel = (props: Props) => {
  const diagram = useDiagram();
  const resizableH = useNodeProperty(diagram, 'capabilities.resizable.horizontal');
  const resizableV = useNodeProperty(diagram, 'capabilities.resizable.vertical');
  const moveable = useNodeProperty(diagram, 'capabilities.moveable');
  const rotatable = useNodeProperty(diagram, 'capabilities.rotatable');

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
          <input
            type={'checkbox'}
            checked={resizableH.val === true}
            onChange={() => resizableH.set(!resizableH.val)}
          />
        </div>

        <div className={'cmp-labeled-table__label'}>Resize Vertically:</div>
        <div className={'cmp-labeled-table__value'}>
          <input
            type={'checkbox'}
            checked={resizableV.val === true}
            onChange={() => resizableV.set(!resizableV.val)}
          />
        </div>

        <div className={'cmp-labeled-table__label'}>Movable:</div>
        <div className={'cmp-labeled-table__value'}>
          <input
            type={'checkbox'}
            checked={moveable.val === true}
            onChange={() => moveable.set(!moveable.val)}
          />
        </div>

        <div className={'cmp-labeled-table__label'}>Rotatable:</div>
        <div className={'cmp-labeled-table__value'}>
          <input
            type={'checkbox'}
            checked={rotatable.val === true}
            onChange={() => rotatable.set(!rotatable.val)}
          />
        </div>
      </div>
    </ToolWindowPanel>
  );
};

type Props = {
  mode?: 'accordion' | 'panel';
};
