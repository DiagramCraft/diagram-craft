import { EditableDiagram } from '../../model-editor/editable-diagram.ts';
import { useEffect, useState } from 'react';
import { Box } from '../../geometry/box.ts';
import { Angle } from '../../geometry/angle.ts';
import { round } from '../../utils/math.ts';
import * as ReactToolbar from '@radix-ui/react-toolbar';
import { TbAspectRatio } from 'react-icons/tb';
import { Point } from '../../geometry/point.ts';
import { MutableSnapshot } from '../../utils/mutableSnapshot.ts';

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
export const TransformProperties = (props: Props) => {
  const [bounds, setBounds] = useState<Box | undefined>(undefined);
  const [lockAspectRatio, setLockAspectRatio] = useState(false);
  const [origin, setOrigin] = useState('top-left');

  const aspectRatio = (bounds?.size.w ?? 1) / (bounds?.size.h ?? 1);

  const transformedBounds = {
    pos: {
      x: (bounds?.pos.x ?? 0) + (bounds?.size.w ?? 1) * origins[origin].x,
      y: (bounds?.pos.y ?? 0) + (bounds?.size.h ?? 1) * origins[origin].y
    },
    size: {
      w: bounds?.size.w ?? 1,
      h: bounds?.size.h ?? 1
    },
    rotation: bounds?.rotation ?? 0
  };

  useEffect(() => {
    const callback = () => {
      const selection = props.diagram.selectionState;
      if (selection.nodes.length === 1) {
        setBounds(selection.nodes[0].bounds);
      } else {
        setBounds(undefined);
      }
    };
    callback();

    props.diagram.selectionState.on('change', callback);
    return () => {
      props.diagram.selectionState.off('change', callback);
    };
  }, []);

  // TODO: This seems a bit complicated just to move an element
  //       ... especially all of the updating of the selection state
  const updateBounds = (newBounds: MutableSnapshot<Box>) => {
    newBounds.get('pos').x -= (transformedBounds.size.w ?? 1) * origins[origin].x;
    newBounds.get('pos').y -= (transformedBounds.size.h ?? 1) * origins[origin].y;

    if (newBounds.get('size').w !== transformedBounds.size.w) {
      const dw = newBounds.get('size').w - transformedBounds.size.w;
      newBounds.get('pos').x -= dw * origins[origin].x;
    }

    if (newBounds.get('size').h !== transformedBounds.size.h) {
      const dh = newBounds.get('size').h - transformedBounds.size.h;
      newBounds.get('pos').y -= dh * origins[origin].y;
    }

    if (newBounds.get('rotation') !== transformedBounds.rotation) {
      const newPos = Point.rotateAround(
        {
          x: 0,
          y: 0
        },
        newBounds.get('rotation'),
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
        transformedBounds.rotation,
        {
          x: origins[origin].x - 0.5,
          y: origins[origin].y - 0.5
        }
      );
      newBounds.set('pos', {
        x:
          newBounds.get('pos').x -
          prevPos.x * transformedBounds.size.w +
          newPos.x * newBounds.get('size').w,
        y:
          newBounds.get('pos').y -
          prevPos.y * transformedBounds.size.h +
          newPos.y * newBounds.get('size').h
      });
    }

    props.diagram.selectionState.elements[0].bounds = newBounds.getSnapshot();
    props.diagram.selectionState.guides = [];
    props.diagram.selectionState.recalculateBoundingBox();
    props.diagram.updateElement(props.diagram.selectionState.elements[0]);
  };

  return (
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
            gridTemplateAreas: '"xLbl x wLbl w" "yLbl y hLbl h" "rLbl r gap aspect-ratio"',
            gridTemplateRows: 'repeat(3, 1fr)',
            gridTemplateColumns: 'min-content 1fr min-content 1fr',
            alignItems: 'center',
            gap: '0.5em'
          }}
        >
          <div style={{ gridArea: 'xLbl' }}>X:</div>
          <div style={{ gridArea: 'yLbl' }}>Y:</div>
          <div style={{ gridArea: 'wLbl' }}>W:</div>
          <div style={{ gridArea: 'hLbl' }}>H:</div>
          <div style={{ gridArea: 'rLbl' }}>R:</div>
          <div style={{ gridArea: 'x' }}>
            <input
              type={'number'}
              value={round(transformedBounds.pos.x)}
              min={0}
              style={{ width: '100%' }}
              onChange={ev => {
                const newBounds = Box.asMutableSnapshot(transformedBounds!);
                newBounds.get('pos').x = parseFloat(ev.target.value);
                updateBounds(newBounds);
              }}
            />
          </div>
          <div style={{ gridArea: 'y' }}>
            <input
              type={'number'}
              value={round(transformedBounds.pos.y)}
              min={0}
              style={{ width: '100%' }}
              onChange={ev => {
                const newBounds = Box.asMutableSnapshot(transformedBounds!);
                newBounds.get('pos').y = parseFloat(ev.target.value);
                updateBounds(newBounds);
              }}
            />
          </div>
          <div style={{ gridArea: 'w' }}>
            <input
              type={'number'}
              value={round(transformedBounds.size.w ?? 1)}
              min={0}
              style={{ width: '100%' }}
              onChange={ev => {
                const newBounds = Box.asMutableSnapshot(transformedBounds!);
                newBounds.get('size').w = parseFloat(ev.target.value);
                if (lockAspectRatio) {
                  newBounds.get('size').h = newBounds.get('size').w / aspectRatio;
                }
                updateBounds(newBounds);
              }}
            />
          </div>
          <div style={{ gridArea: 'h' }}>
            <input
              type={'number'}
              value={round(transformedBounds.size.h ?? 1)}
              min={0}
              style={{ width: '100%' }}
              onChange={ev => {
                const newBounds = Box.asMutableSnapshot(transformedBounds!);
                newBounds.get('size').h = parseFloat(ev.target.value);
                if (lockAspectRatio) {
                  newBounds.get('size').w = newBounds.get('size').h * aspectRatio;
                }
                updateBounds(newBounds);
              }}
            />
          </div>
          <div style={{ gridArea: 'r' }}>
            <input
              type={'number'}
              value={round(Angle.toDeg(transformedBounds.rotation ?? 0))}
              min={-360}
              max={360}
              style={{ width: '100%' }}
              onChange={ev => {
                const newBounds = Box.asMutableSnapshot(transformedBounds!);
                const number = parseFloat(ev.target.value);
                newBounds.set('rotation', Angle.toRad(isNaN(number) ? 0 : number ?? 0));
                updateBounds(newBounds);
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
  );
};

type Props = {
  diagram: EditableDiagram;
};
