import { useEffect, useState } from 'react';
import { Box, WritableBox } from '../../geometry/box.ts';
import { Angle } from '../../geometry/angle.ts';
import { round } from '../../utils/math.ts';
import * as ReactToolbar from '@radix-ui/react-toolbar';
import { TbAspectRatio } from 'react-icons/tb';
import { Point } from '../../geometry/point.ts';
import { NumberInput } from '../NumberInput.tsx';
import { useDiagram } from '../context/DiagramContext.tsx';
import { ToolWindowPanel } from '../components/ToolWindowPanel.tsx';

const origins: Record<string, Point> = {
  'top-left': { x: 0, y: 0 },
  'top-center': { x: 0.5, y: 0 },
  'top-right': { x: 1, y: 0 },
  'mid-left': { x: 0, y: 0.5 },
  'mid-center': { x: 0.5, y: 0.5 },
  'mid-right': { x: 1, y: 0.5 },
  'bottom-left': { x: 0, y: 1 },
  'bottom-center': { x: 0.5, y: 1 },
  'bottom-right': { x: 1, y: 1 }
};

// TODO: Implement transform origin
export const TransformPanel = (props: Props) => {
  const diagram = useDiagram();
  const [bounds, setBounds] = useState<Box | undefined>(undefined);
  const [lockAspectRatio, setLockAspectRatio] = useState(false);
  const [origin, setOrigin] = useState('top-left');

  const aspectRatio = (bounds?.w ?? 1) / (bounds?.h ?? 1);

  const transformedBounds = {
    x: (bounds?.x ?? 0) + (bounds?.w ?? 1) * origins[origin].x,
    y: (bounds?.y ?? 0) + (bounds?.h ?? 1) * origins[origin].y,
    w: bounds?.w ?? 1,
    h: bounds?.h ?? 1,
    r: bounds?.r ?? 0
  };

  useEffect(() => {
    const callback = () => {
      const selection = diagram.selectionState;
      if (selection.getSelectionType() === 'single-node') {
        setBounds(selection.nodes[0].bounds);
      } else {
        setBounds(undefined);
      }
    };
    callback();

    diagram.selectionState.on('change', callback);
    return () => {
      diagram.selectionState.off('change', callback);
    };
  }, [diagram.selectionState]);

  // TODO: This seems a bit complicated just to move an element
  //       ... especially all of the updating of the selection state
  const updateBounds = (bounds: Box) => {
    const newBounds = Box.asReadWrite(bounds);
    newBounds.x -= (transformedBounds.w ?? 1) * origins[origin].x;
    newBounds.y -= (transformedBounds.h ?? 1) * origins[origin].y;

    if (newBounds.w !== transformedBounds.w) {
      const dw = newBounds.w - transformedBounds.w;
      newBounds.x -= dw * origins[origin].x;
    }

    if (newBounds.h !== transformedBounds.h) {
      const dh = newBounds.h - transformedBounds.h;
      newBounds.y -= dh * origins[origin].y;
    }

    if (newBounds.r !== transformedBounds.r) {
      const newPos = Point.rotateAround(
        {
          x: 0,
          y: 0
        },
        newBounds.r,
        {
          x: origins[origin].x - 0.5,
          y: origins[origin].y - 0.5
        }
      );
      const prevPos = Point.rotateAround(
        {
          x: 0,
          y: 0
        },
        transformedBounds.r,
        {
          x: origins[origin].x - 0.5,
          y: origins[origin].y - 0.5
        }
      );
      newBounds.x = newBounds.x - prevPos.x * transformedBounds.w + newPos.x * newBounds.w;
      newBounds.y = newBounds.y - prevPos.y * transformedBounds.h + newPos.y * newBounds.h;
    }

    diagram.selectionState.elements[0].bounds = WritableBox.asBox(newBounds);
    diagram.selectionState.guides = [];
    diagram.updateElement(diagram.selectionState.elements[0]);
  };

  return (
    <ToolWindowPanel
      mode={props.mode ?? 'accordion'}
      id="transform"
      title={'Transform'}
      hasCheckbox={false}
    >
      <div className={'cmp-labeled-table'}>
        <div
          className={'cmp-labeled-table__label'}
          style={{ alignSelf: 'start', marginTop: '0.1rem' }}
        >
          <svg width={'3rem'} height={'3rem'} viewBox={'0 0 1 1'}>
            <rect
              x={0.1}
              y={0.1}
              width={0.8}
              height={0.8}
              fill={'transparent'}
              stroke={'var(--primary-fg)'}
              strokeDasharray={'0.05 0.05'}
              strokeWidth={0.02}
            />
            {Object.entries(origins).map(([k, v]) => (
              <circle
                key={k}
                cx={0.1 + v.x * 0.8}
                cy={0.1 + v.y * 0.8}
                r={0.08}
                fill={origin === k ? 'var(--blue-11)' : 'var(--primary-bg)'}
                stroke={origin === k ? 'var(--blue-11)' : 'var(--primary-fg)'}
                strokeWidth={0.02}
                cursor={'pointer'}
                onClick={() => setOrigin(k)}
              />
            ))}
          </svg>
        </div>
        <div className={'cmp-labeled-table__value'}>
          <div
            style={{
              display: 'grid',
              gridTemplateAreas: '"x w" "y h" "r aspect-ratio"',
              gridTemplateRows: 'repeat(3, 1fr)',
              gridTemplateColumns: '1fr 1fr',
              alignItems: 'center',
              rowGap: '0.5rem',
              columnGap: '0.3em'
            }}
          >
            <div style={{ gridArea: 'x' }}>
              <NumberInput
                style={{ width: '100%' }}
                label={'x'}
                value={round(transformedBounds.x)}
                defaultUnit={'px'}
                min={0}
                onChange={ev => {
                  updateBounds({
                    ...transformedBounds,
                    x: ev ?? 0
                  });
                }}
              />
            </div>
            <div style={{ gridArea: 'y' }}>
              <NumberInput
                style={{ width: '100%' }}
                label={'y'}
                value={round(transformedBounds.y)}
                defaultUnit={'px'}
                min={0}
                onChange={ev => {
                  updateBounds({
                    ...transformedBounds,
                    y: ev ?? 0
                  });
                }}
              />
            </div>
            <div style={{ gridArea: 'w' }}>
              <NumberInput
                style={{ width: '100%' }}
                value={round(transformedBounds.w ?? 1)}
                label={'w'}
                defaultUnit={'px'}
                min={0}
                onChange={ev => {
                  updateBounds({
                    ...transformedBounds,
                    w: ev ?? 0,
                    ...(lockAspectRatio ? { h: (ev ?? 0) / aspectRatio } : {})
                  });
                }}
              />
            </div>
            <div style={{ gridArea: 'h' }}>
              <NumberInput
                style={{ width: '100%' }}
                value={round(transformedBounds.h ?? 1)}
                label={'h'}
                defaultUnit={'px'}
                min={0}
                onChange={ev => {
                  updateBounds({
                    ...transformedBounds,
                    ...(lockAspectRatio ? { w: (ev ?? 0) * aspectRatio } : {}),
                    h: ev ?? 0
                  });
                }}
              />
            </div>
            <div style={{ gridArea: 'r' }}>
              <NumberInput
                style={{ width: '100%' }}
                value={round(Angle.toDeg(transformedBounds.r ?? 0))}
                label={'r'}
                min={-360}
                max={360}
                defaultUnit={'°'}
                onChange={ev => {
                  const number = ev ?? 0;
                  updateBounds({
                    ...transformedBounds,
                    r: Angle.toRad(isNaN(number) ? 0 : number ?? 0)
                  });
                }}
              />
            </div>

            <div style={{ gridArea: 'aspect-ratio', justifySelf: 'end' }}>
              <ReactToolbar.Root className="cmp-toolbar" aria-label="Formatting options">
                <ReactToolbar.ToggleGroup
                  type={'single'}
                  value={lockAspectRatio ? 'maintain' : 'free'}
                  onValueChange={value => {
                    setLockAspectRatio(value === 'maintain');
                  }}
                >
                  <ReactToolbar.ToggleItem className="cmp-toolbar__toggle-item" value={'maintain'}>
                    <TbAspectRatio />
                  </ReactToolbar.ToggleItem>
                </ReactToolbar.ToggleGroup>
              </ReactToolbar.Root>
            </div>
          </div>
        </div>
      </div>
    </ToolWindowPanel>
  );
};

type Props = {
  mode?: 'accordion' | 'panel';
};
