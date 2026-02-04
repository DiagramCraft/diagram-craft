import { ToolDialog } from '../components/ToolDialog';
import { NumberInput } from '@diagram-craft/app-components/NumberInput';
import { useEffect, useState } from 'react';
import { ToggleButtonGroup } from '@diagram-craft/app-components/ToggleButtonGroup';
import { TbArrowDown, TbArrowLeft, TbArrowRight, TbArrowUp } from 'react-icons/tb';
import type { LayoutOrthogonalActionArgs, LayoutOrthogonalActionDirection } from './layoutOrthogonalAction';

type LayoutOrthogonalActionDialogProps = {
  onCancel: () => void;
  onApply: (state: LayoutOrthogonalActionArgs) => void;
  onChange: (state: LayoutOrthogonalActionArgs) => void;
};

export const LayoutOrthogonalActionDialog = (props: LayoutOrthogonalActionDialogProps) => {
  const [gap, setGap] = useState(45);
  const [direction, setDirection] = useState<LayoutOrthogonalActionDirection>('down');

  useEffect(() => {
    props.onChange({ gap, direction });
  }, [gap, direction, props.onChange]);

  return (
    <ToolDialog
      open={true}
      title={'Orthogonal Layout'}
      onCancel={props.onCancel}
      onOk={() => props.onApply({ gap, direction })}
    >
      <div style={{ marginLeft: '0.5rem' }}>Gap:</div>
      <NumberInput value={gap} onChange={v => setGap(v ?? 0)} size={6} />

      <div style={{ marginLeft: '0.5rem' }}>Direction:</div>
      <ToggleButtonGroup.Root
        value={direction}
        onChange={d => setDirection(d as unknown as LayoutOrthogonalActionDirection)}
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
