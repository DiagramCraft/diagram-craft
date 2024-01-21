import { additionalHues, primaryColors } from './palette.ts';
import { ColorPicker } from '../components/ColorPicker.tsx';
import { useNodeProperty } from './useProperty.ts';
import { TbAdjustmentsHorizontal } from 'react-icons/tb';
import { ToolWindowPanel } from '../ToolWindowPanel.tsx';
import { assertFillType } from '../../model/diagramProps.ts';
import { useDiagram } from '../context/DiagramContext.tsx';
import { useNodeDefaults } from '../useDefaults.tsx';
import { round } from '../../utils/math.ts';
import { SliderAndNumberInput } from '../SliderAndNumberInput.tsx';
import { Select } from '../components/Select.tsx';
import { Collapsible } from '../components/Collapsible.tsx';
import { PopoverButton } from '../components/PopoverButton.tsx';

const TEXTURES = [
  'bubbles1.jpeg',
  'grunge1.jpeg',
  'grunge2.jpeg',
  'grunge3.jpeg',
  'marble1.jpeg',
  'marble2.jpeg',
  'paper1.jpeg',
  'paper2.jpeg',
  'paper3.jpeg',
  'paper4.jpeg',
  'paper5.jpeg',
  'textile1.jpeg'
];

const PATTERNS = [
  `<pattern id="#ID#" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="4" fill="#BG#" /><line x1="0" y1="0" x2="0" y2="4" stroke="#FG#" stroke-width="2" /></pattern>`,
  `<pattern id="#ID#" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(90)"><rect width="4" height="4" fill="#BG#" /><line x1="0" y1="0" x2="0" y2="4" stroke="#FG#" stroke-width="2" /></pattern>`,
  `<pattern id="#ID#" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="4" height="4" fill="#BG#" /><line x1="0" y1="0" x2="0" y2="4" stroke="#FG#" stroke-width="2" /></pattern>`,
  `<pattern id="#ID#" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><rect width="4" height="4" fill="#BG#" /><line x1="0" y1="0" x2="0" y2="4" stroke="#FG#" stroke-width="2" /></pattern>`,

  `<pattern id="#ID#" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><rect width="4" height="4" fill="#BG#" /> <line x1="0" y1="0" x2="0" y2="4" stroke="#FG#" strokeWidth="2" /><line x1="0" y1="0" x2="4" y2="0" stroke="#FG#" stroke-width="2" /></pattern>`,
  `<pattern id="#ID#" x="2" y="2" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="4" fill="#BG#" /><line x1="0" y1="0" x2="0" y2="4" stroke="#FG#" strokeWidth="2" /><line x1="0" y1="0" x2="4" y2="0" stroke="#FG#" stroke-width="2" /></pattern>`,
  `<pattern id="#ID#" x="2" y="2" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="4" fill="#BG#" /><rect x="0" y="0" width="1" height="1" fill="#FG#" /></pattern>`,
  `<pattern id="#ID#" x="2" y="2" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><rect width="4" height="4" fill="#BG#" /><rect x="0" y="0" width="1" height="1" fill="#FG#" /></pattern>`,

  `<pattern id="#ID#" x="2" y="2" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="4" fill="#BG#" /><rect x="0" y="0" width="2" height="2" fill="#FG#" /><rect x="2" y="2" width="2" height="2" fill="#FG#" /></pattern>`,
  `<pattern id="#ID#" x="2" y="2" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#BG#" /><rect x="0" y="0" width="4" height="4" fill="#FG#" /><rect x="4" y="4" width="4" height="4" fill="#FG#" /></pattern>`,
  `<pattern id="#ID#" x="2" y="2" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><rect width="4" height="4" fill="#BG#" /><rect x="0" y="0" width="2" height="2" fill="#FG#" /><rect x="2" y="2" width="2" height="2" fill="#FG#" /></pattern>`,
  `<pattern id="#ID#" x="2" y="2" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><rect width="8" height="8" fill="#BG#" /><rect x="0" y="0" width="4" height="4" fill="#FG#" /><rect x="4" y="4" width="4" height="4" fill="#FG#" /></pattern>`
];

const ImageScale = (props: {
  fillImageScale: number;
  onChange: (v: number | undefined) => void;
}) => (
  <>
    <div className={'cmp-labeled-table__label'}>Scale:</div>
    <div className={'cmp-labeled-table__value'}>
      <SliderAndNumberInput value={round(props.fillImageScale * 100)} onChange={props.onChange} />
    </div>
  </>
);

const ImageTint = (props: {
  tint: string;
  onChangeTint: (v: string) => void;
  tintStrength: number;
  onChangeTintStrength: (v: number | undefined) => void;
}) => (
  <Collapsible label={'Tint'}>
    <div className={'cmp-labeled-table'}>
      <div className={'cmp-labeled-table__label util-a-top-center'}>Tint:</div>
      <div className={'cmp-labeled-table__value'}>
        <ColorPicker
          primaryColors={primaryColors}
          additionalHues={additionalHues}
          color={props.tint}
          onClick={props.onChangeTint}
          canClearColor={true}
        />
      </div>
      <div className={'cmp-labeled-table__label util-a-top-center'}>Strength:</div>
      <div className={'cmp-labeled-table__value'}>
        <SliderAndNumberInput
          value={round(props.tintStrength * 100)}
          onChange={props.onChangeTintStrength}
        />
      </div>
    </div>
  </Collapsible>
);

const ImageAdjustments = (props: {
  contrast: number;
  onChangeContrast: (v: number | undefined) => void;
  brightness: number;
  onChangeBrightness: (v: number | undefined) => void;
  saturation: number;
  onChangeSaturation: (v: number | undefined) => void;
}) => (
  <Collapsible label={'Adjustments'}>
    <div className={'cmp-labeled-table'}>
      <div className={'cmp-labeled-table__label util-a-top-center'}>Contrast:</div>
      <div className={'cmp-labeled-table__value'}>
        <SliderAndNumberInput
          max={200}
          value={round(props.contrast * 100)}
          onChange={props.onChangeContrast}
        />
      </div>

      <div className={'cmp-labeled-table__label util-a-top-center'}>Brightness:</div>
      <div className={'cmp-labeled-table__value'}>
        <SliderAndNumberInput
          max={200}
          value={round(props.brightness * 100)}
          onChange={props.onChangeBrightness}
        />
      </div>

      <div className={'cmp-labeled-table__label util-a-top-center'}>Saturation:</div>
      <div className={'cmp-labeled-table__value'}>
        <SliderAndNumberInput
          max={200}
          value={round(props.saturation * 100)}
          onChange={props.onChangeSaturation}
        />
      </div>
    </div>
  </Collapsible>
);

export const NodeFillPanel = (props: Props) => {
  const diagram = useDiagram();
  const defaults = useNodeDefaults();

  const color = useNodeProperty(diagram, 'fill.color', defaults.fill.color);
  const fillPattern = useNodeProperty(diagram, 'fill.pattern', '');
  const fillImage = useNodeProperty(diagram, 'fill.image.id', '');
  const fillImageFit = useNodeProperty(diagram, 'fill.image.fit', defaults.fill.image.fit);
  const fillImageW = useNodeProperty(diagram, 'fill.image.w', defaults.fill.image.w);
  const fillImageH = useNodeProperty(diagram, 'fill.image.h', defaults.fill.image.h);
  const fillImageScale = useNodeProperty(diagram, 'fill.image.scale', defaults.fill.image.scale);
  const fillImageTint = useNodeProperty(diagram, 'fill.image.tint', defaults.fill.image.tint);
  const fillImageTintStrength = useNodeProperty(
    diagram,
    'fill.image.tintStrength',
    defaults.fill.image.tintStrength
  );
  const fillImageBrightness = useNodeProperty(
    diagram,
    'fill.image.brightness',
    defaults.fill.image.brightness
  );
  const fillImageContrast = useNodeProperty(
    diagram,
    'fill.image.contrast',
    defaults.fill.image.contrast
  );
  const fillImageSaturation = useNodeProperty(
    diagram,
    'fill.image.saturation',
    defaults.fill.image.saturation
  );
  const color2 = useNodeProperty(diagram, 'fill.color2', defaults.fill.color2);
  const type = useNodeProperty(diagram, 'fill.type', defaults.fill.type);
  const enabled = useNodeProperty(diagram, 'fill.enabled', defaults.fill.enabled);

  return (
    <ToolWindowPanel
      mode={props.mode ?? 'accordion'}
      id="fill"
      title={'Fill'}
      hasCheckbox={true}
      value={enabled.val}
      onChange={enabled.set}
    >
      <div className={'cmp-labeled-table'}>
        <div className={'cmp-labeled-table__label'}>Type:</div>
        <div className={'cmp-labeled-table__value'}>
          <Select
            onValueChange={v => {
              assertFillType(v);
              type.set(v);
            }}
            value={type.val}
            values={[
              { label: 'Solid', value: 'solid' },
              { label: 'Gradient', value: 'gradient' },
              { label: 'Pattern', value: 'pattern' },
              { label: 'Texture', value: 'texture' },
              { label: 'Image', value: 'image' }
            ]}
          />
        </div>

        {(type.val === 'gradient' || type.val === 'solid') && (
          <>
            <div className={'cmp-labeled-table__label'}>Color:</div>
            <div className={'cmp-labeled-table__value util-hstack'}>
              <ColorPicker
                primaryColors={primaryColors}
                additionalHues={additionalHues}
                color={color.val}
                onClick={color.set}
                hasMultipleValues={color.hasMultipleValues}
              />
              {type.val === 'gradient' && (
                <>
                  <ColorPicker
                    primaryColors={primaryColors}
                    additionalHues={additionalHues}
                    color={color2.val}
                    onClick={color2.set}
                    hasMultipleValues={color2.hasMultipleValues}
                  />
                  <PopoverButton label={<TbAdjustmentsHorizontal />}>
                    <h2>Gradient</h2>
                  </PopoverButton>
                </>
              )}
            </div>
          </>
        )}

        {type.val === 'pattern' && (
          <>
            <div className={'cmp-labeled-table__label util-a-top-center'}>Pattern:</div>
            <div className={'cmp-labeled-table__value'}>
              {PATTERNS.map((p, idx) => (
                <svg
                  key={idx}
                  width={35}
                  height={35}
                  style={{
                    border: '1px solid var(--blue-6)',
                    borderRadius: 2,
                    overflow: 'hidden',
                    marginRight: '0.2rem'
                  }}
                  onClick={async () => {
                    const att = await diagram.document.attachments.addAttachment(new Blob([p]));
                    fillPattern.set(att.hash);
                  }}
                >
                  <defs
                    dangerouslySetInnerHTML={{
                      __html: p
                        .replace('#ID#', `pattern-preview-${idx}`)
                        .replaceAll('#BG#', color.val)
                        .replaceAll('#FG#', color2.val)
                    }}
                  ></defs>
                  <rect width={35} height={35} fill={`url(#pattern-preview-${idx}`} />
                </svg>
              ))}
            </div>

            <div className={'cmp-labeled-table__label util-a-top-center'}>Color:</div>
            <div className={'cmp-labeled-table__value util-hstack'}>
              <ColorPicker
                primaryColors={primaryColors}
                additionalHues={additionalHues}
                color={color.val}
                onClick={color.set}
                hasMultipleValues={color.hasMultipleValues}
              />
              <ColorPicker
                primaryColors={primaryColors}
                additionalHues={additionalHues}
                color={color2.val}
                onClick={color2.set}
                hasMultipleValues={color2.hasMultipleValues}
              />
            </div>
          </>
        )}

        {type.val === 'texture' && (
          <>
            <div className={'cmp-labeled-table__label util-a-top-center'}>Texture:</div>
            <div className={'cmp-labeled-table__value'}>
              {TEXTURES.map(t => (
                <img
                  key={t}
                  src={`/textures/${t}`}
                  style={{
                    width: 35,
                    height: 35,
                    marginRight: '0.2rem',
                    border: '1px solid var(--blue-6)',
                    borderRadius: 2
                  }}
                  onClick={async () => {
                    const response = await fetch(`/textures/${t}`);
                    const blob = await response.blob();
                    const att = await diagram.document.attachments.addAttachment(blob);

                    const img = await createImageBitmap(att.content);
                    const { width, height } = img;
                    img.close();

                    diagram.undoManager.combine(() => {
                      fillImage.set(att.hash);
                      fillImageFit.set('tile');
                      fillImageW.set(width);
                      fillImageH.set(height);
                    });
                  }}
                />
              ))}
            </div>

            <ImageScale
              fillImageScale={fillImageScale.val}
              onChange={v => {
                fillImageScale.set(Number(v) / 100);
              }}
            />

            <ImageAdjustments
              contrast={fillImageContrast.val}
              onChangeContrast={v => {
                fillImageContrast.set(Number(v) / 100);
              }}
              brightness={fillImageBrightness.val}
              onChangeBrightness={v => {
                fillImageBrightness.set(Number(v) / 100);
              }}
              saturation={fillImageSaturation.val}
              onChangeSaturation={v => {
                fillImageSaturation.set(Number(v) / 100);
              }}
            />

            <ImageTint
              tint={fillImageTint.val}
              onChangeTint={fillImageTint.set}
              tintStrength={fillImageTintStrength.val}
              onChangeTintStrength={v => {
                fillImageTintStrength.set(Number(v) / 100);
              }}
            />
          </>
        )}

        {type.val === 'image' && (
          <>
            <div className={'cmp-labeled-table__label util-a-top-center'}>Image:</div>
            <div className={'cmp-labeled-table__value'}>
              <div style={{ display: 'flex', alignItems: 'top' }}>
                <label
                  className={'cmp-button'}
                  style={{ fontSize: '11px', justifyContent: 'left' }}
                  htmlFor={'fill-file-upload'}
                >
                  Upload...
                </label>
                &nbsp;
                <button
                  className={'cmp-button'}
                  style={{ fontSize: '11px' }}
                  disabled={fillImage.val === ''}
                  onClick={() => {
                    diagram.undoManager.combine(() => {
                      fillImage.set('');
                      fillImageW.set(0);
                      fillImageH.set(0);
                    });
                    (document.getElementById('fill-file-upload') as HTMLInputElement).value = '';
                  }}
                >
                  Clear
                </button>
                <input
                  id={'fill-file-upload'}
                  style={{ display: 'none', width: 0 }}
                  type="file"
                  onChange={async e => {
                    // TODO: Should add a spinner...

                    const att = await diagram.document.attachments.addAttachment(
                      e.target.files![0]
                    );

                    const img = await createImageBitmap(att.content);
                    const { width, height } = img;
                    img.close();

                    diagram.undoManager.combine(() => {
                      fillImage.set(att.hash);
                      fillImageW.set(width);
                      fillImageH.set(height);
                      fillImageTint.set('');
                    });
                  }}
                />
              </div>
              <div>
                {fillImage.val !== '' && fillImage.val !== undefined && (
                  <img
                    src={diagram.document.attachments.getAttachment(fillImage.val)?.url}
                    style={{ marginTop: '0.5rem', maxWidth: 80, maxHeight: 80 }}
                  />
                )}
              </div>
            </div>
            <div className={'cmp-labeled-table__label util-a-top-center'}>Fit:</div>
            <div className={'cmp-labeled-table__value'}>
              <Select
                onValueChange={v => {
                  // eslint-disable-next-line
                  fillImageFit.set(v as any);
                }}
                value={fillImageFit.val}
                values={[
                  { label: 'Fill', value: 'fill' },
                  { label: 'Contain', value: 'contain' },
                  { label: 'Cover', value: 'cover' },
                  { label: 'Keep', value: 'keep' },
                  { label: 'Tile', value: 'tile' }
                ]}
              />
            </div>

            {fillImageFit.val === 'tile' && (
              <ImageScale
                fillImageScale={fillImageScale.val}
                onChange={v => {
                  fillImageScale.set(Number(v) / 100);
                }}
              />
            )}

            <ImageAdjustments
              contrast={fillImageContrast.val}
              onChangeContrast={v => {
                fillImageContrast.set(Number(v) / 100);
              }}
              brightness={fillImageBrightness.val}
              onChangeBrightness={v => {
                fillImageBrightness.set(Number(v) / 100);
              }}
              saturation={fillImageSaturation.val}
              onChangeSaturation={v => {
                fillImageSaturation.set(Number(v) / 100);
              }}
            />

            <ImageTint
              tint={fillImageTint.val}
              onChangeTint={fillImageTint.set}
              tintStrength={fillImageTintStrength.val}
              onChangeTintStrength={v => {
                fillImageTintStrength.set(Number(v) / 100);
              }}
            />
          </>
        )}
      </div>
    </ToolWindowPanel>
  );
};

type Props = {
  mode?: 'accordion' | 'panel';
};
