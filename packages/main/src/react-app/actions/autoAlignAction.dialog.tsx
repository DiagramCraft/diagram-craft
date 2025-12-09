import { ToolDialog } from '../components/ToolDialog';
import { NumberInput } from '@diagram-craft/app-components/NumberInput';
import { useEffect, useState } from 'react';
import { ToggleButtonGroup } from '@diagram-craft/app-components/ToggleButtonGroup';
import {
  TbArrowsMove,
  TbResize,
  TbGrid4X4,
  TbBox,
  TbRulerMeasure,
  TbBorderAll,
  TbArrowAutofitWidth,
  TbDimensions
} from 'react-icons/tb';
import type { AutoAlignConfig } from './autoAlignAction';

type AutoAlignActionDialogProps = {
  onCancel: () => void;
  onApply: (config: AutoAlignConfig) => void;
  onChange: (config: AutoAlignConfig) => void;
};

const getMagnetTypes = (selectedMagnetTypes: string[]) => ({
  canvas: selectedMagnetTypes.includes('canvas'),
  grid: selectedMagnetTypes.includes('grid'),
  guide: selectedMagnetTypes.includes('guide'),
  node: selectedMagnetTypes.includes('node'),
  distance: selectedMagnetTypes.includes('distance'),
  size: selectedMagnetTypes.includes('size')
});

export const AutoAlignActionDialog = (props: AutoAlignActionDialogProps) => {
  const [threshold, setThreshold] = useState(10);
  const [selectedModes, setSelectedModes] = useState<string[]>(['move', 'resize']);
  const [selectedMagnetTypes, setSelectedMagnetTypes] = useState<string[]>(['grid']);

  // Calculate mode from selected modes
  const mode: 'move' | 'resize' | 'both' | 'none' =
    selectedModes.length === 0
      ? 'none'
      : selectedModes.includes('move') && selectedModes.includes('resize')
        ? 'both'
        : selectedModes.includes('resize')
          ? 'resize'
          : 'move';

  useEffect(() => {
    props.onChange({ threshold, magnetTypes: getMagnetTypes(selectedMagnetTypes), mode });
  }, [threshold, selectedMagnetTypes, mode, props.onChange]);

  return (
    <ToolDialog
      open={true}
      title={'Auto-Align'}
      onCancel={props.onCancel}
      onOk={() =>
        props.onApply({ threshold, magnetTypes: getMagnetTypes(selectedMagnetTypes), mode })
      }
    >
      <div style={{ marginLeft: '0.5rem' }}>Distance:</div>
      <NumberInput value={threshold} onChange={v => setThreshold(v ?? 10)} size={6} />

      <div style={{ marginLeft: '0.5rem' }}>Mode:</div>
      <ToggleButtonGroup.Root
        value={selectedModes}
        onChange={m => setSelectedModes(m as string[])}
        type={'multiple'}
      >
        <ToggleButtonGroup.Item value={'move'}>
          <TbArrowsMove />
        </ToggleButtonGroup.Item>
        <ToggleButtonGroup.Item value={'resize'}>
          <TbResize />
        </ToggleButtonGroup.Item>
      </ToggleButtonGroup.Root>

      <div style={{ marginLeft: '0.5rem' }}>Snap:</div>
      <ToggleButtonGroup.Root
        value={selectedMagnetTypes}
        onChange={m => setSelectedMagnetTypes(m as string[])}
        type={'multiple'}
      >
        <ToggleButtonGroup.Item value={'grid'}>
          <TbGrid4X4 />
        </ToggleButtonGroup.Item>
        <ToggleButtonGroup.Item value={'node'}>
          <TbBox />
        </ToggleButtonGroup.Item>
        <ToggleButtonGroup.Item value={'guide'}>
          <TbRulerMeasure />
        </ToggleButtonGroup.Item>
        <ToggleButtonGroup.Item value={'canvas'}>
          <TbBorderAll />
        </ToggleButtonGroup.Item>
        <ToggleButtonGroup.Item value={'distance'}>
          <TbArrowAutofitWidth />
        </ToggleButtonGroup.Item>
        <ToggleButtonGroup.Item value={'size'}>
          <TbDimensions />
        </ToggleButtonGroup.Item>
      </ToggleButtonGroup.Root>
    </ToolDialog>
  );
};
