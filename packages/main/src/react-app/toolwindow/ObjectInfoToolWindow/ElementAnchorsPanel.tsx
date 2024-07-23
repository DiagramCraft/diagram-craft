import { ToolWindowPanel } from '../ToolWindowPanel';
import { useNodeProperty } from '../../hooks/useProperty';
import { useDiagram } from '../../context/DiagramContext';
import { Select } from '@diagram-craft/app-components/Select';
import { NumberInput } from '@diagram-craft/app-components/NumberInput';

export const ElementAnchorsPanel = (props: Props) => {
  const diagram = useDiagram();
  const type = useNodeProperty(diagram, 'anchors.type');
  const perEdge = useNodeProperty(diagram, 'anchors.perEdgeCount');
  const directionsCount = useNodeProperty(diagram, 'anchors.directionsCount');

  const disabled =
    !diagram.selectionState.isNodesOnly() ||
    diagram.selectionState.nodes.some(e => !e.getDefinition().supports('custom-anchors'));

  return (
    <ToolWindowPanel
      mode={props.mode ?? 'accordion'}
      id="anchors"
      title={'Anchor Points'}
      hasCheckbox={false}
    >
      <div className={'cmp-labeled-table'}>
        <div className={'cmp-labeled-table__label'}>Type:</div>
        <div className={'cmp-labeled-table__value'}>
          <Select.Root
            value={type.val}
            onValueChange={v => {
              // @ts-ignore
              type.set(v);
            }}
            disabled={disabled}
          >
            <Select.Item value={'none'}>No anchors</Select.Item>
            <Select.Item value={'shape-defaults'}>Default</Select.Item>
            <Select.Item value={'north-south'}>North/South</Select.Item>
            <Select.Item value={'east-west'}>East/West</Select.Item>
            <Select.Item value={'directions'}>x number of anchors</Select.Item>
            <Select.Item value={'per-edge'}>x number per edge</Select.Item>
          </Select.Root>
        </div>

        <div className={'cmp-labeled-table__label'}>Number:</div>
        <div className={'cmp-labeled-table__value'}>
          <NumberInput
            value={
              type.val === 'per-edge'
                ? perEdge.val
                : type.val === 'directions'
                  ? directionsCount.val
                  : 0
            }
            disabled={disabled || (type.val !== 'per-edge' && type.val !== 'directions')}
            onChange={v => {
              if (type.val === 'per-edge') {
                perEdge.set(v);
              } else if (type.val === 'directions') {
                directionsCount.set(v);
              }
            }}
          />
        </div>
      </div>
    </ToolWindowPanel>
  );
};

type Props = {
  mode?: 'accordion' | 'panel';
};
