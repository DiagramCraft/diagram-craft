import { useDiagram } from '../../../application';
import { useRedraw } from '../../hooks/useRedraw';
import { useNodeProperty } from '../../hooks/useProperty';
import { useEventListener } from '../../hooks/useEventListener';
import { ToolWindowPanel } from '../ToolWindowPanel';
import { NumberInput } from '@diagram-craft/app-components/NumberInput';
import { Select } from '@diagram-craft/app-components/Select';
import { ToggleButtonGroup } from '@diagram-craft/app-components/ToggleButtonGroup';
import { Checkbox } from '@diagram-craft/app-components/Checkbox';
import { TbArrowsHorizontal, TbArrowsVertical } from 'react-icons/tb';
import { NodeFlags } from '@diagram-craft/model/elementDefinitionRegistry';

export const LayoutContainerPanel = (props: Props) => {
  const diagram = useDiagram();
  const redraw = useRedraw();

  const enabled = useNodeProperty(diagram, 'layout.container.enabled');
  const direction = useNodeProperty(diagram, 'layout.container.direction');
  const gap = useNodeProperty(diagram, 'layout.container.gap');
  const autoShrink = useNodeProperty(diagram, 'layout.container.autoShrink');
  const justifyContent = useNodeProperty(diagram, 'layout.container.justifyContent');
  const alignItems = useNodeProperty(diagram, 'layout.container.alignItems');
  const paddingTop = useNodeProperty(diagram, 'layout.container.padding.top');
  const paddingRight = useNodeProperty(diagram, 'layout.container.padding.right');
  const paddingBottom = useNodeProperty(diagram, 'layout.container.padding.bottom');
  const paddingLeft = useNodeProperty(diagram, 'layout.container.padding.left');

  useEventListener(diagram.selection, 'change', redraw);

  const shouldShow =
    diagram.selection.isNodesOnly() &&
    diagram.selection.nodes.every(n => n.getDefinition().hasFlag(NodeFlags.ChildrenCanHaveLayout));

  if (!shouldShow) return null;

  return (
    <ToolWindowPanel
      mode={props.mode ?? 'accordion'}
      id="layout-container"
      title={'Container Layout'}
      hasCheckbox={true}
      value={enabled.val}
      onChange={enabled.set}
    >
      <div className={'cmp-labeled-table'}>
        <div className={'cmp-labeled-table__label'}>Direction</div>
        <div className={'cmp-labeled-table__value'}>
          <ToggleButtonGroup.Root
            type="single"
            value={direction.val}
            onChange={v => direction.set(v as 'horizontal' | 'vertical' | undefined)}
          >
            <ToggleButtonGroup.Item value="horizontal">
              <TbArrowsHorizontal />
            </ToggleButtonGroup.Item>
            <ToggleButtonGroup.Item value="vertical">
              <TbArrowsVertical />
            </ToggleButtonGroup.Item>
          </ToggleButtonGroup.Root>
        </div>

        <div className={'cmp-labeled-table__label'}>Gap</div>
        <div className={'cmp-labeled-table__value'}>
          <NumberInput
            value={gap.val}
            onChange={gap.set}
            defaultUnit="px"
            min={0}
            style={{ width: '60px' }}
          />
        </div>

        <div className={'cmp-labeled-table__label'}>Auto Shrink</div>
        <div className={'cmp-labeled-table__value'}>
          <Checkbox value={autoShrink.val ?? false} onChange={autoShrink.set} />
        </div>

        <div className={'cmp-labeled-table__label'}>Justify</div>
        <div className={'cmp-labeled-table__value'}>
          <Select.Root
            value={justifyContent.val}
            onChange={v =>
              justifyContent.set(v as 'start' | 'end' | 'center' | 'space-between' | undefined)
            }
          >
            <Select.Item value="start">Start</Select.Item>
            <Select.Item value="end">End</Select.Item>
            <Select.Item value="center">Center</Select.Item>
            <Select.Item value="space-between">Space Between</Select.Item>
          </Select.Root>
        </div>

        <div className={'cmp-labeled-table__label'}>Align</div>
        <div className={'cmp-labeled-table__value'}>
          <Select.Root
            value={alignItems.val}
            onChange={v =>
              alignItems.set(v as 'start' | 'end' | 'center' | 'stretch' | 'preserve' | undefined)
            }
          >
            <Select.Item value="start">Start</Select.Item>
            <Select.Item value="end">End</Select.Item>
            <Select.Item value="center">Center</Select.Item>
            <Select.Item value="stretch">Stretch</Select.Item>
            <Select.Item value="preserve">Preserve</Select.Item>
          </Select.Root>
        </div>

        <div className={'cmp-labeled-table__label util-a-top-center'}>Padding</div>
        <div className={'cmp-labeled-table__value'}>
          <div
            style={{
              display: 'grid',
              gap: '0.25rem',
              gridTemplateColumns: 'repeat(3, 45px)',
              gridTemplateRows: 'repeat(3, 1fr)'
            }}
          >
            <div
              style={{
                margin: '0.75rem 1.5rem',
                borderLeft: '1px solid var(--cmp-border)',
                borderTop: '1px solid var(--cmp-border)',
                width: 'calc(100% - 1.75rem)',
                height: 'calc(100% - 1rem)'
              }}
            />
            <NumberInput
              value={paddingTop.val}
              onChange={paddingTop.set}
              defaultUnit="px"
              min={0}
              style={{ width: '45px' }}
            />
            <div
              style={{
                margin: '0.75rem 0',
                borderRight: '1px solid var(--cmp-border)',
                borderTop: '1px solid var(--cmp-border)',
                width: 'calc(100% - 1.5rem)',
                height: 'calc(100% - 1rem)'
              }}
            />

            <NumberInput
              value={paddingLeft.val}
              onChange={paddingLeft.set}
              defaultUnit="px"
              min={0}
              style={{ width: '45px' }}
            />
            <div></div>
            <NumberInput
              value={paddingRight.val}
              onChange={paddingRight.set}
              defaultUnit="px"
              min={0}
              style={{ width: '45px' }}
            />

            <div
              style={{
                margin: '0.25rem 1.5rem',
                borderLeft: '1px solid var(--cmp-border)',
                borderBottom: '1px solid var(--cmp-border)',
                width: 'calc(100% - 1.75rem)',
                height: 'calc(100% - 1rem)'
              }}
            />
            <NumberInput
              value={paddingBottom.val}
              onChange={paddingBottom.set}
              defaultUnit="px"
              min={0}
              style={{ width: '45px' }}
            />
            <div
              style={{
                margin: '0.25rem 0',
                borderRight: '1px solid var(--cmp-border)',
                borderBottom: '1px solid var(--cmp-border)',
                width: 'calc(100% - 1.5rem)',
                height: 'calc(100% - 1rem)'
              }}
            />
          </div>
        </div>
      </div>
    </ToolWindowPanel>
  );
};

type Props = {
  mode?: 'accordion' | 'panel';
};
