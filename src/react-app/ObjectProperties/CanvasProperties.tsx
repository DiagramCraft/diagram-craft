import { EditableDiagram } from '../../model-editor/editable-diagram.ts';
import { useRedraw } from '../../react-canvas-viewer/useRedraw.tsx';
import { useEventListener } from '../hooks/useEventListener.ts';
import { NumberInput } from '../NumberInput.tsx';
import { round } from '../../utils/math.ts';
import { Box } from '../../geometry/box.ts';
import { MutableSnapshot } from '../../utils/mutableSnapshot.ts';
import { additionalHues, primaryColors } from './palette.ts';
import { ColorPicker } from '../ColorPicker.tsx';
import { useDiagramProperty } from './useProperty.ts';

export const CanvasProperties = (props: Props) => {
  const redraw = useRedraw();

  useEventListener('canvaschanged', redraw, props.diagram);
  const [bg, setBg] = useDiagramProperty('background.color', props.diagram, 'none');

  const bounds = { ...props.diagram.canvas, rotation: 0 };

  const updateBounds = (newBounds: MutableSnapshot<Box>) => {
    props.diagram.canvas = newBounds.getSnapshot();
  };

  return (
    <>
      <div className={'cmp-labeled-table'}>
        <div className={'cmp-labeled-table__label'}>Color:</div>
        <div className={'cmp-labeled-table__value'}>
          <ColorPicker
            primaryColors={primaryColors}
            additionalHues={additionalHues}
            color={bg ?? 'transparent'}
            onClick={v => {
              setBg(v);
            }}
          />
        </div>

        <div
          className={'cmp-labeled-table__label'}
          style={{ alignSelf: 'start', marginTop: '0.25rem' }}
        >
          Size:
        </div>
        <div className={'cmp-labeled-table__value'}>
          <div
            style={{
              display: 'grid',
              gridTemplateAreas: '"x w" "y h"',
              gridTemplateRows: 'repeat(2, 1fr)',
              gridTemplateColumns: '1fr 1fr',
              alignItems: 'center',
              rowGap: '0.5rem',
              columnGap: '0.3em'
            }}
          >
            <div style={{ gridArea: 'x' }}>
              <NumberInput
                label={'x'}
                style={{ width: '100%' }}
                value={round(bounds.pos.x)}
                validUnits={['px']}
                defaultUnit={'px'}
                onChange={ev => {
                  const newBounds = Box.asMutableSnapshot(bounds!);
                  newBounds.get('size').w += bounds.pos.x - (ev ?? 0);
                  newBounds.get('pos').x = ev ?? 0;
                  updateBounds(newBounds);
                }}
              />
            </div>
            <div style={{ gridArea: 'y' }}>
              <NumberInput
                style={{ width: '100%' }}
                label={'y'}
                value={round(bounds.pos.y)}
                validUnits={['px']}
                defaultUnit={'px'}
                onChange={ev => {
                  const newBounds = Box.asMutableSnapshot(bounds!);
                  newBounds.get('size').h += bounds.pos.y - (ev ?? 0);
                  newBounds.get('pos').y = ev ?? 0;
                  updateBounds(newBounds);
                }}
              />
            </div>
            <div style={{ gridArea: 'w' }}>
              <NumberInput
                style={{ width: '100%' }}
                label={'w'}
                value={round(bounds.size.w ?? 1)}
                validUnits={['px']}
                defaultUnit={'px'}
                onChange={ev => {
                  const newBounds = Box.asMutableSnapshot(bounds!);
                  newBounds.get('size').w = ev ?? 0;
                  updateBounds(newBounds);
                }}
              />
            </div>
            <div style={{ gridArea: 'h' }}>
              <NumberInput
                style={{ width: '100%' }}
                label={'h'}
                value={round(bounds.size.h ?? 1)}
                validUnits={['px']}
                defaultUnit={'px'}
                onChange={ev => {
                  const newBounds = Box.asMutableSnapshot(bounds!);
                  newBounds.get('size').h = ev ?? 0;
                  updateBounds(newBounds);
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

type Props = {
  diagram: EditableDiagram;
};
