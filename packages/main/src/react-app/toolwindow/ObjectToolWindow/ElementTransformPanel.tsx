import { useEffect, useState } from 'react';
import { TbAspectRatio, TbFlipHorizontal, TbFlipVertical } from 'react-icons/tb';
import { Point } from '@diagram-craft/geometry/point';
import { Box, WritableBox } from '@diagram-craft/geometry/box';
import { Angle } from '@diagram-craft/geometry/angle';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { $c } from '@diagram-craft/utils/classname';
import { round } from '@diagram-craft/utils/math';
import { useDiagram } from '../../context/DiagramContext';
import { useNodeDefaults } from '../../hooks/useDefaults';
import { useNodeProperty } from '../../hooks/useProperty';
import { ToolWindowPanel } from '../ToolWindowPanel';
import { NumberInput } from '@diagram-craft/app-components/NumberInput';
import { ToggleButton } from '@diagram-craft/app-components/ToggleButton';

const origins: Record<string, Point> = {
  tl: { x: 0, y: 0 },
  tc: { x: 0.5, y: 0 },
  tr: { x: 1, y: 0 },
  ml: { x: 0, y: 0.5 },
  mc: { x: 0.5, y: 0.5 },
  mr: { x: 1, y: 0.5 },
  bl: { x: 0, y: 1 },
  bc: { x: 0.5, y: 1 },
  br: { x: 1, y: 1 }
};

export const ElementTransformPanel = (props: Props) => {
  const diagram = useDiagram();
  const defaults = useNodeDefaults();

  const [bounds, setBounds] = useState<Box | undefined>(undefined);
  const [lockAspectRatio, setLockAspectRatio] = useState(false);
  const [origin, setOrigin] = useState('tl');

  const flipV = useNodeProperty(diagram, 'geometry.flipV', defaults.geometry.flipV);
  const flipH = useNodeProperty(diagram, 'geometry.flipH', defaults.geometry.flipH);

  const transformedBounds = {
    x: (bounds?.x ?? 0) + (bounds?.w ?? 1) * origins[origin].x,
    y: (bounds?.y ?? 0) + (bounds?.h ?? 1) * origins[origin].y,
    w: bounds?.w ?? 1,
    h: bounds?.h ?? 1,
    r: bounds?.r ?? 0
  };

  const aspectRatio = transformedBounds.w / transformedBounds.h;

  const rotatable = diagram.selectionState.nodes.every(
    p => p.renderProps.capabilities.rotatable !== false
  );
  const resizeableVertically = diagram.selectionState.nodes.every(
    p => p.renderProps.capabilities.resizable.vertical !== false
  );
  const resizeableHorizontally = diagram.selectionState.nodes.every(
    p => p.renderProps.capabilities.resizable.horizontal !== false
  );
  const moveable = diagram.selectionState.nodes.every(
    p => p.renderProps.capabilities.moveable !== false
  );

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
    newBounds.x -= transformedBounds.w * origins[origin].x;
    newBounds.y -= transformedBounds.h * origins[origin].y;

    if (newBounds.w !== transformedBounds.w) {
      const dw = newBounds.w - transformedBounds.w;
      newBounds.x -= dw * origins[origin].x;
    }

    if (newBounds.h !== transformedBounds.h) {
      const dh = newBounds.h - transformedBounds.h;
      newBounds.y -= dh * origins[origin].y;
    }

    if (newBounds.r !== transformedBounds.r) {
      const centerOfRotation = Point.subtract(origins[origin], { x: 0.5, y: 0.5 });
      const newPos = Point.rotateAround(Point.ORIGIN, newBounds.r, centerOfRotation);
      const prevPos = Point.rotateAround(Point.ORIGIN, transformedBounds.r, centerOfRotation);
      newBounds.x = newBounds.x - prevPos.x * transformedBounds.w + newPos.x * newBounds.w;
      newBounds.y = newBounds.y - prevPos.y * transformedBounds.h + newPos.y * newBounds.h;
    }

    UnitOfWork.execute(diagram, uow => {
      diagram.selectionState.elements[0].setBounds(WritableBox.asBox(newBounds), uow);
      diagram.selectionState.guides = [];
    });
  };

  return (
    <ToolWindowPanel
      mode={props.mode ?? 'accordion'}
      id="transform"
      title={'Transform'}
      hasCheckbox={false}
    >
      <div className={'cmp-labeled-table cmp-transform'}>
        <div className={'cmp-labeled-table__label cmp-transform__graphics'}>
          <svg viewBox={'0 0 1 1'}>
            <rect className={'cmp-transform__rect'} x={0.1} y={0.1} width={0.8} height={0.8} />
            {Object.entries(origins).map(([k, v]) => (
              <circle
                key={k}
                className={$c('cmp-transform__node', { active: origin === k })}
                cx={0.1 + v.x * 0.8}
                cy={0.1 + v.y * 0.8}
                r={0.08}
                onClick={() => setOrigin(k)}
              />
            ))}
          </svg>
        </div>
        <div className={'cmp-labeled-table__value'}>
          <div className={'cmp-transform__inputs'}>
            <div style={{ gridArea: 'x' }}>
              <NumberInput
                label={'x'}
                value={round(transformedBounds.x)}
                defaultUnit={'px'}
                disabled={!moveable}
                min={0}
                onChange={ev => updateBounds({ ...transformedBounds, x: ev ?? 0 })}
              />
            </div>
            <div style={{ gridArea: 'y' }}>
              <NumberInput
                label={'y'}
                value={round(transformedBounds.y)}
                defaultUnit={'px'}
                disabled={!moveable}
                min={0}
                onChange={ev => updateBounds({ ...transformedBounds, y: ev ?? 0 })}
              />
            </div>
            <div style={{ gridArea: 'w' }}>
              <NumberInput
                value={round(transformedBounds.w)}
                label={'w'}
                defaultUnit={'px'}
                min={0}
                disabled={!resizeableHorizontally}
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
                value={round(transformedBounds.h)}
                label={'h'}
                defaultUnit={'px'}
                min={0}
                disabled={!resizeableVertically}
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
                value={round(Angle.toDeg(transformedBounds.r))}
                label={'r'}
                min={-360}
                max={360}
                defaultUnit={'°'}
                disabled={!rotatable}
                onChange={ev => {
                  const number = ev ?? 0;
                  updateBounds({
                    ...transformedBounds,
                    r: Angle.toRad(isNaN(number) ? 0 : number)
                  });
                }}
              />
            </div>

            <div style={{ gridArea: 'aspect-ratio', justifySelf: 'end' }}>
              <ToggleButton value={lockAspectRatio} onChange={setLockAspectRatio}>
                <TbAspectRatio />
              </ToggleButton>
            </div>
          </div>
        </div>
        <div className={'cmp-labeled-table__label'}>Flip</div>
        <div className={'cmp-labeled-table__value'}>
          <div className={'util-hstack'}>
            <ToggleButton value={flipV.val} onChange={flipV.set}>
              <TbFlipHorizontal />
            </ToggleButton>
            <ToggleButton value={flipH.val} onChange={flipH.set}>
              <TbFlipVertical />
            </ToggleButton>
          </div>
        </div>
      </div>
    </ToolWindowPanel>
  );
};

type Props = {
  mode?: 'accordion' | 'panel';
};
