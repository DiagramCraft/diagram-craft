import { PropertyEditor } from '../../components/PropertyEditor';
import { round } from '@diagram-craft/utils/math';
import { Slider } from '@diagram-craft/app-components/Slider';
import { ConfigurationContextType, useConfiguration } from '../../context/ConfigurationContext';
import { useDiagram } from '../../../application';
import { Collapsible } from '@diagram-craft/app-components/Collapsible';
import { ColorPicker, ColorPreview } from '../../components/ColorPicker';
import { Select } from '@diagram-craft/app-components/Select';
import { Angle } from '@diagram-craft/geometry/angle';
import { Button } from '@diagram-craft/app-components/Button';
import { FillType } from '@diagram-craft/model/diagramProps';
import { Diagram } from '@diagram-craft/model/diagram';
import { mustExist } from '@diagram-craft/utils/assert';
import type { Property } from '@diagram-craft/model/property';
import { Checkbox } from '@diagram-craft/app-components/Checkbox';
import buttonStyles from '@diagram-craft/app-components/Button.module.css';
import { KeyValueTable } from '@diagram-craft/app-components/KeyValueTable';

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
    <KeyValueTable.Label>Scale:</KeyValueTable.Label>
    <KeyValueTable.Value>
      <PropertyEditor
        property={props.imageScale}
        formatValue={v => round(v * 100)}
        storeValue={v => v / 100}
        render={props => <Slider {...props} />}
      />
    </KeyValueTable.Value>
  </>
);

const ImageTint = (props: { tint: Property<string>; tintStrength: Property<number> }) => {
  const $cfg = useConfiguration();
  const $d = useDiagram();
  return (
    <KeyValueTable.FullRow>
      <Collapsible label={'Tint'}>
        <KeyValueTable.Root>
          <KeyValueTable.Label valign="top">Tint:</KeyValueTable.Label>
          <KeyValueTable.Value>
            <PropertyEditor
              property={props.tint}
              render={props => (
                <ColorPicker
                  {...props}
                  palette={$cfg.palette.primary}
                  canClearColor={true}
                  customPalette={$d.document.customPalette}
                  onChangeCustomPalette={(idx, v) => $d.document.customPalette.setColor(idx, v)}
                />
              )}
            />
          </KeyValueTable.Value>

          <KeyValueTable.Label valign="top">Strength:</KeyValueTable.Label>
          <KeyValueTable.Value>
            <PropertyEditor
              property={props.tintStrength}
              formatValue={v => round(v * 100)}
              storeValue={v => v / 100}
              render={props => <Slider {...props} />}
            />
          </KeyValueTable.Value>
        </KeyValueTable.Root>
      </Collapsible>
    </KeyValueTable.FullRow>
  );
};

const ImageAdjustments = (props: {
  contrast: Property<number>;
  brightness: Property<number>;
  saturation: Property<number>;
}) => (
  <KeyValueTable.FullRow>
    <Collapsible label={'Adjustments'}>
      <KeyValueTable.Root>
        <KeyValueTable.Label valign={'top'}>Contrast:</KeyValueTable.Label>
        <KeyValueTable.Value>
          <PropertyEditor
            property={props.contrast}
            formatValue={v => round(v * 100)}
            storeValue={v => v / 100}
            render={props => <Slider {...props} max={200} />}
          />
        </KeyValueTable.Value>

        <KeyValueTable.Label valign={'top'}>Brightness:</KeyValueTable.Label>
        <KeyValueTable.Value>
          <PropertyEditor
            property={props.brightness}
            formatValue={v => round(v * 100)}
            storeValue={v => v / 100}
            render={props => <Slider {...props} max={200} />}
          />
        </KeyValueTable.Value>

        <KeyValueTable.Label valign={'top'}>Saturation:</KeyValueTable.Label>
        <KeyValueTable.Value>
          <PropertyEditor
            property={props.saturation}
            formatValue={v => round(v * 100)}
            storeValue={v => v / 100}
            render={props => <Slider {...props} max={200} />}
          />
        </KeyValueTable.Value>
      </KeyValueTable.Root>
    </Collapsible>
  </KeyValueTable.FullRow>
);

export const FillPanelForm = ({
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
  palette,
  additionalFills,
  diagram: $d,
  config: $cfg
}: FormProps) => {
  return (
    <KeyValueTable.Root>
      <KeyValueTable.Label>Type:</KeyValueTable.Label>
      <KeyValueTable.Value>
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
      </KeyValueTable.Value>

      {(type.val === 'gradient' || type.val === 'solid') && (
        <>
          <KeyValueTable.Label>Color:</KeyValueTable.Label>
          <KeyValueTable.Value stack={'horizontal'}>
            <PropertyEditor
              property={color}
              render={props => (
                <ColorPicker
                  {...props}
                  extraPalettes={{ Stylesheet: palette }}
                  palette={$cfg.palette.primary}
                  customPalette={$d.document.customPalette}
                  onChangeCustomPalette={(idx, v) => $d.document.customPalette.setColor(idx, v)}
                />
              )}
              renderValue={props => <ColorPreview {...props} />}
            />

            {type.val === 'gradient' && (
              <PropertyEditor
                property={color2}
                render={props => (
                  <ColorPicker
                    {...props}
                    palette={$cfg.palette.primary}
                    customPalette={$d.document.customPalette}
                    onChangeCustomPalette={(idx, v) => $d.document.customPalette.setColor(idx, v)}
                  />
                )}
                renderValue={props => <ColorPreview {...props} />}
              />
            )}
          </KeyValueTable.Value>
        </>
      )}

      {type.val === 'gradient' && (
        <>
          <KeyValueTable.Label>Type:</KeyValueTable.Label>
          <KeyValueTable.Value>
            <PropertyEditor
              property={gradientType as Property<string>}
              render={props => (
                <Select.Root {...props}>
                  <Select.Item value={'linear'}>Linear</Select.Item>
                  <Select.Item value={'radial'}>Radial</Select.Item>
                </Select.Root>
              )}
            />
          </KeyValueTable.Value>

          {gradientType.val === 'linear' && (
            <>
              <KeyValueTable.Label>Direction:</KeyValueTable.Label>
              <KeyValueTable.Value>
                <PropertyEditor
                  property={gradientDirection}
                  formatValue={v => round(Angle.toDeg(v))}
                  storeValue={v => Angle.toRad(Number(v))}
                  render={props => <Slider {...props} unit={'°'} max={360} />}
                />
              </KeyValueTable.Value>
            </>
          )}
        </>
      )}

      {type.val === 'pattern' && (
        <>
          <KeyValueTable.Label valign={'top'}>Pattern:</KeyValueTable.Label>
          <KeyValueTable.Value>
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
          </KeyValueTable.Value>

          <KeyValueTable.Label>Color:</KeyValueTable.Label>
          <KeyValueTable.Value stack={'horizontal'}>
            <PropertyEditor
              property={color}
              render={props => (
                <ColorPicker
                  {...props}
                  palette={$cfg.palette.primary}
                  customPalette={$d.document.customPalette}
                  onChangeCustomPalette={(idx, v) => $d.document.customPalette.setColor(idx, v)}
                />
              )}
              renderValue={props => <ColorPreview {...props} />}
            />
            <PropertyEditor
              property={color2}
              render={props => (
                <ColorPicker
                  {...props}
                  palette={$cfg.palette.primary}
                  customPalette={$d.document.customPalette}
                  onChangeCustomPalette={(idx, v) => $d.document.customPalette.setColor(idx, v)}
                />
              )}
              renderValue={props => <ColorPreview {...props} />}
            />
          </KeyValueTable.Value>
        </>
      )}

      {type.val === 'texture' && (
        <>
          <KeyValueTable.Label valign={'top'}>Texture:</KeyValueTable.Label>
          <KeyValueTable.Value>
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
          </KeyValueTable.Value>

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
          <KeyValueTable.Label valign={'top'}>Image:</KeyValueTable.Label>
          <KeyValueTable.Value>
            <div style={{ display: 'flex', alignItems: 'top' }}>
              <label
                className={buttonStyles.cButton}
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

                  const att = await $d.document.attachments.addAttachment(
                    mustExist(e.target.files![0])
                  );

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
          </KeyValueTable.Value>

          <KeyValueTable.Label valign={'top'}>Fit:</KeyValueTable.Label>
          <KeyValueTable.Value>
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
          </KeyValueTable.Value>

          {imageFit.val === 'tile' && <ImageScale imageScale={imageScale} />}

          <ImageAdjustments
            contrast={imageContrast}
            brightness={imageBrightness}
            saturation={imageSaturation}
          />

          <ImageTint tint={imageTint} tintStrength={imageTintStrength} />
        </>
      )}

      {additionalFills && additionalFills.length > 0 && (
        <>
          <KeyValueTable.Label>Additional:</KeyValueTable.Label>
          <KeyValueTable.Value stack={'vertical'}>
            {additionalFills.map(({ color, enabled }, idx) => (
              <div key={idx} className={'util-hstack'}>
                <PropertyEditor property={enabled} render={props => <Checkbox {...props} />} />
                <PropertyEditor
                  property={color}
                  render={props => (
                    <ColorPicker
                      {...props}
                      palette={$cfg.palette.primary}
                      customPalette={$d.document.customPalette}
                      onChangeCustomPalette={(idx, v) => $d.document.customPalette.setColor(idx, v)}
                    />
                  )}
                />
              </div>
            ))}
          </KeyValueTable.Value>
        </>
      )}
    </KeyValueTable.Root>
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
  additionalFills: Array<{ color: Property<string>; enabled: Property<boolean> }>;
  palette?: string[];
  diagram: Diagram;
  config: ConfigurationContextType;
};
