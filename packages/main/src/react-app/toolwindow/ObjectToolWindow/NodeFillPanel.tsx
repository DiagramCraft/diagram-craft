import { Angle } from '@diagram-craft/geometry/angle';
import { FillType } from '@diagram-craft/model/diagramProps';
import { round } from '@diagram-craft/utils/math';
import { Slider } from '@diagram-craft/app-components/Slider';
import { ConfigurationContextType, useConfiguration } from '../../context/ConfigurationContext';
import { useDiagram } from '../../context/DiagramContext';
import { Collapsible } from '@diagram-craft/app-components/Collapsible';
import { ColorPicker } from '../../components/ColorPicker';
import { useRedraw } from '../../hooks/useRedraw';
import { useElementProperty } from '../../hooks/useProperty';
import { useEventListener } from '../../hooks/useEventListener';
import { ToolWindowPanel } from '../ToolWindowPanel';
import { Select } from '@diagram-craft/app-components/Select';
import { Button } from '@diagram-craft/app-components/Button';
import { Diagram } from '@diagram-craft/model/diagram';
import { Property } from './types';
import { PropertyEditor } from '../../components/PropertyEditor';

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

const ImageScale = (props: { imageScale: Property<number> }) => (
  <>
    <div className={'cmp-labeled-table__label'}>Scale:</div>
    <div className={'cmp-labeled-table__value'}>
      <Slider
        value={round(props.imageScale.val * 100)}
        onChange={v => props.imageScale.set(v === undefined ? undefined : Number(v) / 100)}
        isDefaultValue={!props.imageScale.isSet}
        defaultValue={round(props.imageScale.defaultVal * 100)}
      />
    </div>
  </>
);

const ImageTint = (props: { tint: Property<string>; tintStrength: Property<number> }) => {
  const $cfg = useConfiguration();
  const $d = useDiagram();
  return (
    <Collapsible label={'Tint'}>
      <div className={'cmp-labeled-table'}>
        <div className={'cmp-labeled-table__label util-a-top-center'}>Tint:</div>
        <div className={'cmp-labeled-table__value'}>
          <PropertyEditor
            property={props.tint}
            render={props => (
              <ColorPicker
                {...props}
                palette={$cfg.palette.primary}
                canClearColor={true}
                customPalette={$d.document.customPalette.colors}
                onChangeCustomPalette={(idx, v) => $d.document.customPalette.setColor(idx, v)}
              />
            )}
          />
        </div>
        <div className={'cmp-labeled-table__label util-a-top-center'}>Strength:</div>
        <div className={'cmp-labeled-table__value'}>
          <Slider
            value={round(props.tintStrength.val * 100)}
            onChange={v => props.tintStrength.set(v === undefined ? undefined : Number(v) / 100)}
            isDefaultValue={!props.tintStrength.isSet}
            defaultValue={props.tintStrength.defaultVal * 100}
          />
        </div>
      </div>
    </Collapsible>
  );
};

const ImageAdjustments = (props: {
  contrast: Property<number>;
  brightness: Property<number>;
  saturation: Property<number>;
}) => (
  <Collapsible label={'Adjustments'}>
    <div className={'cmp-labeled-table'}>
      <div className={'cmp-labeled-table__label util-a-top-center'}>Contrast:</div>
      <div className={'cmp-labeled-table__value'}>
        <Slider
          max={200}
          value={round(props.contrast.val * 100)}
          onChange={v => props.contrast.set(v === undefined ? undefined : Number(v) / 100)}
          isDefaultValue={!props.contrast.isSet}
          defaultValue={props.contrast.defaultVal * 100}
        />
      </div>

      <div className={'cmp-labeled-table__label util-a-top-center'}>Brightness:</div>
      <div className={'cmp-labeled-table__value'}>
        <Slider
          max={200}
          value={round(props.brightness.val * 100)}
          onChange={v => props.brightness.set(v === undefined ? undefined : Number(v) / 100)}
          isDefaultValue={!props.brightness.isSet}
          defaultValue={props.brightness.defaultVal * 100}
        />
      </div>

      <div className={'cmp-labeled-table__label util-a-top-center'}>Saturation:</div>
      <div className={'cmp-labeled-table__value'}>
        <Slider
          max={200}
          value={round(props.saturation.val * 100)}
          onChange={v => props.saturation.set(v === undefined ? undefined : Number(v) / 100)}
          isDefaultValue={!props.saturation.isSet}
          defaultValue={props.saturation.defaultVal * 100}
        />
      </div>
    </div>
  </Collapsible>
);

export const NodeFillPanelForm = ({
  type,
  color,
  color2,
  gradientType,
  gradientDirection,
  pattern,
  image,
  imageFit,
  imageW,
  imageH,
  imageScale,
  imageContrast,
  imageBrightness,
  imageSaturation,
  imageTint,
  imageTintStrength,
  diagram: $d,
  config: $cfg
}: FormProps) => {
  return (
    <div className={'cmp-labeled-table'}>
      <div className={'cmp-labeled-table__label'}>Type:</div>
      <div className={'cmp-labeled-table__value'}>
        <PropertyEditor
          property={type as Property<string>}
          render={props => (
            <Select.Root {...props}>
              <Select.Item value={'solid'}>Solid</Select.Item>
              <Select.Item value={'gradient'}>Gradient</Select.Item>
              <Select.Item value={'pattern'}>Pattern</Select.Item>
              <Select.Item value={'texture'}>Texture</Select.Item>
              <Select.Item value={'image'}>Image</Select.Item>
            </Select.Root>
          )}
        />
      </div>

      {(type.val === 'gradient' || type.val === 'solid') && (
        <>
          <div className={'cmp-labeled-table__label'}>Color:</div>
          <div className={'cmp-labeled-table__value util-hstack'}>
            <PropertyEditor
              property={color}
              render={props => (
                <ColorPicker
                  {...props}
                  palette={$cfg.palette.primary}
                  customPalette={$d.document.customPalette.colors}
                  onChangeCustomPalette={(idx, v) => $d.document.customPalette.setColor(idx, v)}
                />
              )}
            />

            {type.val === 'gradient' && (
              <>
                <PropertyEditor
                  property={color2}
                  render={props => (
                    <ColorPicker
                      {...props}
                      palette={$cfg.palette.primary}
                      customPalette={$d.document.customPalette.colors}
                      onChangeCustomPalette={(idx, v) => $d.document.customPalette.setColor(idx, v)}
                    />
                  )}
                />
              </>
            )}
          </div>
        </>
      )}

      {type.val === 'gradient' && (
        <>
          <div className={'cmp-labeled-table__label'}>Type:</div>
          <div className={'cmp-labeled-table__value util-hstack'}>
            <PropertyEditor
              property={gradientType as Property<string>}
              render={props => (
                <Select.Root {...props}>
                  <Select.Item value={'linear'}>Linear</Select.Item>
                  <Select.Item value={'radial'}>Radial</Select.Item>
                </Select.Root>
              )}
            />
          </div>

          {gradientType.val === 'linear' && (
            <>
              <div className={'cmp-labeled-table__label'}>Direction:</div>
              <div className={'cmp-labeled-table__value util-hstack'}>
                <Slider
                  unit={'°'}
                  max={360}
                  value={round(Angle.toDeg(gradientDirection.val))}
                  onChange={v => gradientDirection.set(Angle.toRad(Number(v)))}
                  isDefaultValue={!gradientDirection.isSet}
                  defaultValue={Angle.toDeg(gradientDirection.defaultVal)}
                />
              </div>
            </>
          )}
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
                  const att = await $d.document.attachments.addAttachment(new Blob([p]));
                  pattern.set(att.hash);
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
            <PropertyEditor
              property={color}
              render={props => (
                <ColorPicker
                  {...props}
                  palette={$cfg.palette.primary}
                  customPalette={$d.document.customPalette.colors}
                  onChangeCustomPalette={(idx, v) => $d.document.customPalette.setColor(idx, v)}
                />
              )}
            />
            <PropertyEditor
              property={color2}
              render={props => (
                <ColorPicker
                  {...props}
                  palette={$cfg.palette.primary}
                  customPalette={$d.document.customPalette.colors}
                  onChangeCustomPalette={(idx, v) => $d.document.customPalette.setColor(idx, v)}
                />
              )}
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
                  const att = await $d.document.attachments.addAttachment(blob);

                  const img = await createImageBitmap(att.content);
                  const { width, height } = img;
                  img.close();

                  $d.undoManager.combine(() => {
                    image.set(att.hash);
                    imageFit.set('tile');
                    imageW.set(width);
                    imageH.set(height);
                  });
                }}
              />
            ))}
          </div>

          <ImageScale imageScale={imageScale} />

          <ImageAdjustments
            contrast={imageContrast}
            brightness={imageBrightness}
            saturation={imageSaturation}
          />

          <ImageTint tint={imageTint} tintStrength={imageTintStrength} />
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
              <Button
                type={'secondary'}
                style={{ fontSize: '11px' }}
                disabled={image.val === ''}
                onClick={() => {
                  $d.undoManager.combine(() => {
                    image.set('');
                    imageW.set(0);
                    imageH.set(0);
                  });
                  (document.getElementById('fill-file-upload') as HTMLInputElement).value = '';
                }}
              >
                Clear
              </Button>
              <input
                id={'fill-file-upload'}
                style={{ display: 'none', width: 0 }}
                type="file"
                onChange={async e => {
                  // TODO: Should add a spinner...

                  const att = await $d.document.attachments.addAttachment(e.target.files![0]);

                  const img = await createImageBitmap(att.content);
                  const { width, height } = img;
                  img.close();

                  $d.undoManager.combine(() => {
                    image.set(att.hash);
                    imageW.set(width);
                    imageH.set(height);
                    imageTint.set('');
                  });
                }}
              />
            </div>
            <div>
              {image.val !== '' && image.val !== undefined && (
                <img
                  src={$d.document.attachments.getAttachment(image.val)?.url}
                  style={{ marginTop: '0.5rem', maxWidth: 80, maxHeight: 80 }}
                />
              )}
            </div>
          </div>
          <div className={'cmp-labeled-table__label util-a-top-center'}>Fit:</div>
          <div className={'cmp-labeled-table__value'}>
            <PropertyEditor
              property={imageFit as Property<string>}
              render={props => (
                <Select.Root {...props}>
                  <Select.Item value={'fill'}>Fill</Select.Item>
                  <Select.Item value={'contain'}>Contain</Select.Item>
                  <Select.Item value={'cover'}>Cover</Select.Item>
                  <Select.Item value={'keep'}>Keep</Select.Item>
                  <Select.Item value={'tile'}>Tile</Select.Item>
                </Select.Root>
              )}
            />
          </div>

          {imageFit.val === 'tile' && <ImageScale imageScale={imageScale} />}

          <ImageAdjustments
            contrast={imageContrast}
            brightness={imageBrightness}
            saturation={imageSaturation}
          />

          <ImageTint tint={imageTint} tintStrength={imageTintStrength} />
        </>
      )}
    </div>
  );
};

type FormProps = {
  type: Property<FillType>;
  color: Property<string>;
  color2: Property<string>;
  gradientType: Property<'linear' | 'radial'>;
  gradientDirection: Property<number>;
  pattern: Property<string>;
  image: Property<string>;
  imageFit: Property<'fill' | 'contain' | 'cover' | 'keep' | 'tile'>;
  imageW: Property<number>;
  imageH: Property<number>;
  imageScale: Property<number>;
  imageContrast: Property<number>;
  imageBrightness: Property<number>;
  imageSaturation: Property<number>;
  imageTint: Property<string>;
  imageTintStrength: Property<number>;
  diagram: Diagram;
  config: ConfigurationContextType;
};

export const NodeFillPanel = (props: Props) => {
  const $d = useDiagram();
  const $cfg = useConfiguration();
  const redraw = useRedraw();

  const color = useElementProperty($d, 'fill.color');
  const pattern = useElementProperty($d, 'fill.pattern', '');
  const image = useElementProperty($d, 'fill.image.id', '');
  const imageFit = useElementProperty($d, 'fill.image.fit');
  const imageW = useElementProperty($d, 'fill.image.w');
  const imageH = useElementProperty($d, 'fill.image.h');
  const imageScale = useElementProperty($d, 'fill.image.scale');
  const imageTint = useElementProperty($d, 'fill.image.tint');
  const imageTintStrength = useElementProperty($d, 'fill.image.tintStrength');
  const imageBrightness = useElementProperty($d, 'fill.image.brightness');
  const imageContrast = useElementProperty($d, 'fill.image.contrast');
  const imageSaturation = useElementProperty($d, 'fill.image.saturation');
  const color2 = useElementProperty($d, 'fill.color2');
  const type = useElementProperty($d, 'fill.type');
  const enabled = useElementProperty($d, 'fill.enabled');
  const gradientDirection = useElementProperty($d, 'fill.gradient.direction', 0);
  const gradientType = useElementProperty($d, 'fill.gradient.type', 'linear');

  useEventListener($d.selectionState, 'change', redraw);

  const panelDisabled =
    $d.selectionState.nodes.every(n => !n.getDefinition().supports('fill')) &&
    $d.selectionState.edges.every(n => !n.getDefinition().supports('fill'));

  if (panelDisabled) return null;

  return (
    <ToolWindowPanel
      mode={props.mode ?? 'accordion'}
      id="fill"
      title={'Fill'}
      hasCheckbox={true}
      value={enabled.val}
      onChange={enabled.set}
    >
      <NodeFillPanelForm
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
    </ToolWindowPanel>
  );
};

type Props = {
  mode?: 'accordion' | 'panel';
};
