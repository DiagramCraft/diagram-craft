import type { ReactNode } from 'react';
import { TbAspectRatio } from 'react-icons/tb';
import { Angle } from '@diagram-craft/geometry/angle';
import type { Box } from '@diagram-craft/geometry/box';
import { round } from '@diagram-craft/utils/math';
import { NumberInput } from '@diagram-craft/app-components/NumberInput';
import { ToggleButton } from '@diagram-craft/app-components/ToggleButton';
import { KeyValueTable } from '@diagram-craft/app-components/KeyValueTable';
import {
  transformOrigins,
  type TransformOrigin
} from './transformPanelUtils';
import styles from './TransformPanelForm.module.css';

type Props = {
  bounds: Box;
  origin: TransformOrigin;
  setOrigin: (origin: TransformOrigin) => void;
  lockAspectRatio: boolean;
  setLockAspectRatio: (value: boolean) => void;
  readOnly?: boolean;
  disabled?: {
    x?: boolean;
    y?: boolean;
    w?: boolean;
    h?: boolean;
    r?: boolean;
  };
  onBoundsChange: (bounds: Box) => void;
  extraRows?: ReactNode;
};

export const TransformPanelForm = ({
  bounds,
  origin,
  setOrigin,
  lockAspectRatio,
  setLockAspectRatio,
  readOnly = false,
  disabled,
  onBoundsChange,
  extraRows
}: Props) => {
  const aspectRatio = bounds.w / bounds.h;

  return (
    <div className={styles.eTransformPanelForm}>
      <KeyValueTable.Root>
        <KeyValueTable.Label valign="top" style={{ marginTop: '0.1rem' }}>
          <svg viewBox={'0 0 1 1'} className={styles.eGraphics}>
            <rect className={styles.eRect} x={0.1} y={0.1} width={0.8} height={0.8} />
            {Object.entries(transformOrigins).map(([k, v]) => (
              <circle
                key={k}
                className={styles.eNode}
                data-active={origin === k}
                cx={0.1 + v.x * 0.8}
                cy={0.1 + v.y * 0.8}
                r={0.08}
                onClick={() => {
                  if (readOnly) return;
                  setOrigin(k as TransformOrigin);
                }}
              />
            ))}
          </svg>
        </KeyValueTable.Label>
        <KeyValueTable.Value>
          <div className={styles.eInputs}>
            <div style={{ gridArea: 'x' }}>
              <NumberInput
                label={'x'}
                value={round(bounds.x)}
                defaultUnit={'px'}
                disabled={disabled?.x}
                min={0}
                onChange={ev => onBoundsChange({ ...bounds, x: ev ?? 0 })}
              />
            </div>
            <div style={{ gridArea: 'y' }}>
              <NumberInput
                label={'y'}
                value={round(bounds.y)}
                defaultUnit={'px'}
                disabled={disabled?.y}
                min={0}
                onChange={ev => onBoundsChange({ ...bounds, y: ev ?? 0 })}
              />
            </div>
            <div style={{ gridArea: 'w' }}>
              <NumberInput
                value={round(bounds.w)}
                label={'w'}
                defaultUnit={'px'}
                min={0}
                disabled={disabled?.w}
                onChange={ev => {
                  onBoundsChange({
                    ...bounds,
                    w: ev ?? 0,
                    ...(lockAspectRatio ? { h: (ev ?? 0) / aspectRatio } : {})
                  });
                }}
              />
            </div>
            <div style={{ gridArea: 'h' }}>
              <NumberInput
                value={round(bounds.h)}
                label={'h'}
                defaultUnit={'px'}
                min={0}
                disabled={disabled?.h}
                onChange={ev => {
                  onBoundsChange({
                    ...bounds,
                    ...(lockAspectRatio ? { w: (ev ?? 0) * aspectRatio } : {}),
                    h: ev ?? 0
                  });
                }}
              />
            </div>
            <div style={{ gridArea: 'r' }}>
              <NumberInput
                value={round(Angle.toDeg(bounds.r))}
                label={'r'}
                min={-360}
                max={360}
                defaultUnit={'°'}
                disabled={disabled?.r}
                onChange={ev =>
                  onBoundsChange({
                    ...bounds,
                    r: Angle.toRad(Number.isNaN(ev ?? 0) ? 0 : (ev ?? 0))
                  })
                }
              />
            </div>

            <div style={{ gridArea: 'aspect-ratio', justifySelf: 'end' }}>
              <ToggleButton
                value={lockAspectRatio}
                disabled={readOnly}
                onChange={setLockAspectRatio}
              >
                <TbAspectRatio />
              </ToggleButton>
            </div>
          </div>
        </KeyValueTable.Value>

        {extraRows}
      </KeyValueTable.Root>
    </div>
  );
};
