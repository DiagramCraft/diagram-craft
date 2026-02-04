import { ToolDialog } from '../components/ToolDialog';
import { NumberInput } from '@diagram-craft/app-components/NumberInput';
import { useEffect, useState } from 'react';
import type { LayoutForceDirectedActionArgs } from './layoutForceDirectedAction';
import { round } from '@diagram-craft/utils/math';

type LayoutForceDirectedActionDialogProps = {
  onCancel: () => void;
  onApply: (state: LayoutForceDirectedActionArgs) => void;
  onChange: (state: LayoutForceDirectedActionArgs) => void;
};

export const LayoutForceDirectedActionDialog = (props: LayoutForceDirectedActionDialogProps) => {
  const [springStrength, setSpringStrength] = useState(0.5);
  const [repulsionStrength, setRepulsionStrength] = useState(1.0);
  const [idealEdgeLength, setIdealEdgeLength] = useState(100);
  const [iterations] = useState(300);

  useEffect(() => {
    props.onChange({ springStrength, repulsionStrength, idealEdgeLength, iterations });
  }, [springStrength, repulsionStrength, idealEdgeLength, iterations, props.onChange]);

  return (
    <ToolDialog
      open={true}
      title={'Force-Directed'}
      onCancel={props.onCancel}
      onOk={() => props.onApply({ springStrength, repulsionStrength, idealEdgeLength, iterations })}
    >
      <div style={{ marginLeft: '0.5rem' }}>Spring:</div>
      <NumberInput
        value={springStrength}
        onChange={v => setSpringStrength(round(v ?? 0.5, 1))}
        min={0}
        max={2}
        step={0.1}
        size={6}
      />

      <div style={{ marginLeft: '0.5rem' }}>Repulsion:</div>
      <NumberInput
        value={repulsionStrength}
        onChange={v => setRepulsionStrength(round(v ?? 1.0, 1))}
        min={0}
        max={5}
        step={0.1}
        size={6}
      />

      <div style={{ marginLeft: '0.5rem' }}>Length:</div>
      <NumberInput
        value={idealEdgeLength}
        onChange={v => setIdealEdgeLength(v ?? 100)}
        min={20}
        max={300}
        step={5}
        size={6}
      />
    </ToolDialog>
  );
};
