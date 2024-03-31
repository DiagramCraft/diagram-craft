import { useRedraw } from '../../react-canvas-viewer/useRedraw.tsx';
import { useEventListener } from '../hooks/useEventListener.ts';
import { NumberInput } from '../components/NumberInput.tsx';
import { round } from '../../utils/math.ts';
import { Box } from '../../geometry/box.ts';
import { ColorPicker } from '../components/ColorPicker.tsx';
import { useDiagramProperty } from './useProperty.ts';
import { useDiagram } from '../context/DiagramContext.ts';
import { ToolWindowPanel } from '../ToolWindowPanel.tsx';
import { useConfiguration } from '../context/ConfigurationContext.ts';

export const CanvasPanel = (props: Props) => {
  const $cfg = useConfiguration();
  const redraw = useRedraw();
  const diagram = useDiagram();

  useEventListener(diagram, 'change', redraw);
  const bg = useDiagramProperty(diagram, 'background.color', 'white');

  const bounds = { ...diagram.canvas, r: 0 };

  const updateBounds = (newBounds: Box) => {
    diagram.canvas = newBounds;
  };

  return (
    <ToolWindowPanel
      mode={props.mode ?? 'accordion'}
      id="canvas"
      title={'Canvas'}
      hasCheckbox={false}
    >
      <div className={'cmp-labeled-table'}>
        <div className={'cmp-labeled-table__label'}>Color:</div>
        <div className={'cmp-labeled-table__value'}>
          <ColorPicker
            palette={$cfg.palette.primary}
            color={bg.val ?? 'transparent'}
            onChange={v => {
              bg.set(v);
            }}
            customPalette={diagram.document.customPalette.colors}
            onChangeCustomPalette={(idx, v) => diagram.document.customPalette.setColor(idx, v)}
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
                value={round(bounds.x)}
                validUnits={['px']}
                defaultUnit={'px'}
                onChange={ev => {
                  updateBounds({
                    ...bounds,
                    w: bounds.w + bounds.x - (ev ?? 0),
                    x: ev ?? 0
                  });
                }}
              />
            </div>
            <div style={{ gridArea: 'y' }}>
              <NumberInput
                style={{ width: '100%' }}
                label={'y'}
                value={round(bounds.y)}
                validUnits={['px']}
                defaultUnit={'px'}
                onChange={ev => {
                  updateBounds({
                    ...bounds,
                    h: bounds.h + bounds.y - (ev ?? 0),
                    y: ev ?? 0
                  });
                }}
              />
            </div>
            <div style={{ gridArea: 'w' }}>
              <NumberInput
                style={{ width: '100%' }}
                label={'w'}
                value={round(bounds.w)}
                validUnits={['px']}
                defaultUnit={'px'}
                onChange={ev => {
                  updateBounds({
                    ...bounds,
                    w: ev ?? 0
                  });
                }}
              />
            </div>
            <div style={{ gridArea: 'h' }}>
              <NumberInput
                style={{ width: '100%' }}
                label={'h'}
                value={round(bounds.h)}
                validUnits={['px']}
                defaultUnit={'px'}
                onChange={ev => {
                  updateBounds({
                    ...bounds,
                    h: ev ?? 0
                  });
                }}
              />
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
