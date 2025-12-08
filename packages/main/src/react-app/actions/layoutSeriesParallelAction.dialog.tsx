import { ToolDialog } from '../components/ToolDialog';
import { NumberInput } from '@diagram-craft/app-components/NumberInput';
import { useEffect, useState } from 'react';
import { ToggleButtonGroup } from '@diagram-craft/app-components/ToggleButtonGroup';
import { TbArrowDown, TbArrowLeft, TbArrowRight, TbArrowUp } from 'react-icons/tb';
import type {
  LayoutSeriesParallelActionArgs,
  LayoutSeriesParallelActionDirection
} from './layoutSeriesParallelAction';

type LayoutSeriesParallelActionDialogProps = {
  onCancel: () => void;
  onApply: (state: LayoutSeriesParallelActionArgs) => void;
  onChange: (state: LayoutSeriesParallelActionArgs) => void;
};

export const LayoutSeriesParallelActionDialog = (
  props: LayoutSeriesParallelActionDialogProps
) => {
  const [gap, setGap] = useState(45);
  const [direction, setDirection] = useState<LayoutSeriesParallelActionDirection>('down');

  useEffect(() => {
    props.onChange({ gap, direction });
  }, [gap, direction, props.onChange]);

  return (
    <ToolDialog
      open={true}
      title={'Series-Parallel'}
      onCancel={props.onCancel}
      onOk={() => props.onApply({ gap, direction })}
    >
      <div style={{ marginLeft: '0.5rem' }}>Gap:</div>
      <NumberInput value={gap} onChange={v => setGap(v ?? 0)} size={6} />

      <div style={{ marginLeft: '0.5rem' }}>Direction:</div>
      <ToggleButtonGroup.Root
        value={direction}
        onChange={d => setDirection(d as unknown as LayoutSeriesParallelActionDirection)}
        aria-label="Formatting options"
        type={'single'}
      >
        <ToggleButtonGroup.Item value={'down'}>
          <TbArrowDown />
        </ToggleButtonGroup.Item>
        <ToggleButtonGroup.Item value={'up'}>
          <TbArrowUp />
        </ToggleButtonGroup.Item>
        <ToggleButtonGroup.Item value={'left'}>
          <TbArrowLeft />
        </ToggleButtonGroup.Item>
        <ToggleButtonGroup.Item value={'right'}>
          <TbArrowRight />
        </ToggleButtonGroup.Item>
      </ToggleButtonGroup.Root>
    </ToolDialog>
  );
};
