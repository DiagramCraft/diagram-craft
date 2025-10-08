import { Box } from '@diagram-craft/geometry/box';
import { round } from '@diagram-craft/utils/math';
import { useConfiguration } from '../../context/ConfigurationContext';
import { useRedraw } from '../../hooks/useRedraw';
import { useEventListener } from '../../hooks/useEventListener';
import { useDiagramProperty } from '../../hooks/useProperty';
import { ToolWindowPanel, type ToolWindowPanelMode } from '../ToolWindowPanel';
import { NumberInput } from '@diagram-craft/app-components/NumberInput';
import { useDiagram } from '../../../application';
import { FillPanelForm } from './FillPanel';
import { nodeDefaults } from '@diagram-craft/model/diagramDefaults';

const DEFAULTS = nodeDefaults.applyDefaults({}).fill!;

export const CanvasPanel = (props: Props) => {
  const $d = useDiagram();
  const $cfg = useConfiguration();
  const redraw = useRedraw();

  useEventListener($d, 'diagramChange', redraw);

  const bounds = { ...$d.canvas, r: 0 };

  const color = useDiagramProperty($d, 'background.color', 'white');
  const pattern = useDiagramProperty($d, 'background.pattern', '');
  const image = useDiagramProperty($d, 'background.image.id', '');
  const imageFit = useDiagramProperty($d, 'background.image.fit', DEFAULTS.image!.fit);
  const imageW = useDiagramProperty($d, 'background.image.w', DEFAULTS.image!.w);
  const imageH = useDiagramProperty($d, 'background.image.h', DEFAULTS.image!.h);
  const imageScale = useDiagramProperty($d, 'background.image.scale', DEFAULTS.image!.scale);
  const imageTint = useDiagramProperty($d, 'background.image.tint', DEFAULTS.image!.tint);
  const imageTintStrength = useDiagramProperty(
    $d,
    'background.image.tintStrength',
    DEFAULTS.image!.tintStrength
  );
  const imageBrightness = useDiagramProperty(
    $d,
    'background.image.brightness',
    DEFAULTS.image!.brightness
  );
  const imageContrast = useDiagramProperty(
    $d,
    'background.image.contrast',
    DEFAULTS.image!.contrast
  );
  const imageSaturation = useDiagramProperty(
    $d,
    'background.image.saturation',
    DEFAULTS.image!.saturation
  );
  const color2 = useDiagramProperty($d, 'background.color2', DEFAULTS.color2);
  const type = useDiagramProperty($d, 'background.type', 'solid');
  const gradientDirection = useDiagramProperty(
    $d,
    'background.gradient.direction',
    DEFAULTS.gradient!.direction
  );
  const gradientType = useDiagramProperty($d, 'background.gradient.type', 'linear');

  const updateBounds = (newBounds: Box) => {
    $d.canvas = newBounds;
  };

  return (
    <ToolWindowPanel
      mode={props.mode ?? 'accordion'}
      id="canvas"
      title={'Canvas'}
      hasCheckbox={false}
    >
      <div className={'cmp-labeled-table'}>
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

      <div style={{ marginTop: '0.5rem' }}>
        <FillPanelForm
          config={$cfg}
          diagram={$d}
          type={type}
          imageBrightness={imageBrightness}
          imageScale={imageScale}
          imageContrast={imageContrast}
          color={color}
          imageSaturation={imageSaturation}
          color2={color2}
          image={image}
          gradientDirection={gradientDirection}
          gradientType={gradientType}
          imageFit={imageFit}
          imageH={imageH}
          imageTint={imageTint}
          imageTintStrength={imageTintStrength}
          imageW={imageW}
          pattern={pattern}
        />
      </div>
    </ToolWindowPanel>
  );
};

type Props = {
  mode?: ToolWindowPanelMode;
};
