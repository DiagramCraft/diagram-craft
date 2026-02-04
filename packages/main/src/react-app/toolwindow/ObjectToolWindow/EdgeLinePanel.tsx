import { TbLine, TbShape3, TbVectorBezier2, TbVectorSpline } from 'react-icons/tb';
import { ArrowSelector } from './components/ArrowSelector';
import { ConfigurationContextType, useConfiguration } from '../../context/ConfigurationContext';
import { useEdgeProperty } from '../../hooks/useProperty';
import { ToolWindowPanel } from '../ToolWindowPanel';
import { NumberInput } from '@diagram-craft/app-components/NumberInput';
import { ColorPicker, ColorPreview } from '../../components/ColorPicker';
import { DashSelector } from './components/DashSelector';
import { Select } from '@diagram-craft/app-components/Select';
import { ToggleButtonGroup } from '@diagram-craft/app-components/ToggleButtonGroup';
import { PropertyEditor } from '../../components/PropertyEditor';
import { Diagram } from '@diagram-craft/model/diagram';
import { EdgeType, LineCap, LineJoin } from '@diagram-craft/model/diagramProps';
import { useDiagram } from '../../../application';
import type { Property } from '@diagram-craft/model/property';
import { EdgeFlags } from '@diagram-craft/model/edgeDefinition';

type FormProps = {
  diagram: Diagram;
  config: ConfigurationContextType;
  type: Property<EdgeType>;
  startType: Property<string>;
  startSize: Property<number>;
  endType: Property<string>;
  endSize: Property<number>;

  strokeColor: Property<string>;
  strokeSize: Property<number>;
  strokeWidth: Property<number>;

  lineCap: Property<LineCap>;
  lineJoin: Property<LineJoin>;
  miterLimit: Property<number>;
  lineHopsSize: Property<number>;
  lineHopsType: Property<'none' | 'below-line' | 'above-arc' | 'below-arc' | 'below-hide'>;
  fillColor: Property<string>;
  strokeSpacing: Property<number>;
  pattern: Property<string>;

  supportsArrows: boolean;
  supportsLineHops: boolean;
  supportsFill: boolean;
};

export const EdgeLinePanelForm = ({
  type,
  supportsArrows,
  startType,
  endType,
  startSize,
  endSize,
  strokeSize,
  strokeWidth,
  lineCap,
  lineJoin,
  miterLimit,
  lineHopsSize,
  lineHopsType,
  supportsLineHops,
  strokeColor,
  supportsFill,
  fillColor,
  strokeSpacing,
  pattern,
  config: $cfg,
  diagram: $d
}: FormProps) => {
  return (
    <div className={'cmp-labeled-table'}>
      <div className={'cmp-labeled-table__label'}>Type:</div>
      <div className={'cmp-labeled-table__value'}>
        <PropertyEditor
          property={type as Property<string>}
          render={props => (
            <ToggleButtonGroup.Root {...props} aria-label="Formatting options" type={'single'}>
              <ToggleButtonGroup.Item value={'straight'}>
                <TbLine />
              </ToggleButtonGroup.Item>
              <ToggleButtonGroup.Item value={'orthogonal'}>
                <TbShape3 />
              </ToggleButtonGroup.Item>
              <ToggleButtonGroup.Item value={'curved'}>
                <TbVectorSpline />
              </ToggleButtonGroup.Item>
              <ToggleButtonGroup.Item value={'bezier'}>
                <TbVectorBezier2 />
              </ToggleButtonGroup.Item>
            </ToggleButtonGroup.Root>
          )}
        />
      </div>

      {supportsArrows && (
        <>
          <div className={'cmp-labeled-table__label'}>Line start:</div>
          <div className={'cmp-labeled-table__value util-vcenter util-hstack'}>
            <ArrowSelector property={startType} />
            <PropertyEditor
              property={startSize}
              render={props => (
                <NumberInput {...props} defaultUnit={'%'} min={1} style={{ width: '50px' }} />
              )}
            />
          </div>

          <div className={'cmp-labeled-table__label'}>Line end:</div>
          <div className={'cmp-labeled-table__value util-vcenter util-hstack'}>
            <ArrowSelector property={endType} />
            <PropertyEditor
              property={endSize}
              render={props => (
                <NumberInput {...props} defaultUnit={'%'} min={1} style={{ width: '50px' }} />
              )}
            />
          </div>
        </>
      )}

      <div className={'cmp-labeled-table__label'}>Color:</div>
      <div className={'cmp-labeled-table__value util-vcenter util-hstack'}>
        <PropertyEditor
          property={strokeColor}
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

        {!supportsFill && (
          <PropertyEditor
            property={fillColor}
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
      </div>

      <div className={'cmp-labeled-table__label'}>Width:</div>
      <div className={'cmp-labeled-table__value'}>
        <PropertyEditor
          property={strokeWidth}
          render={props => (
            <NumberInput {...props} defaultUnit={'px'} min={1} style={{ width: '45px' }} />
          )}
        />
      </div>

      <div className={'cmp-labeled-table__label'}>Dash:</div>
      <div className={'cmp-labeled-table__value util-vcenter util-hstack'}>
        <DashSelector property={pattern} />
        <PropertyEditor
          property={strokeSize}
          render={props => (
            <NumberInput {...props} defaultUnit={'%'} min={1} style={{ width: '45px' }} />
          )}
        />

        <PropertyEditor
          property={strokeSpacing}
          render={props => (
            <NumberInput {...props} defaultUnit={'%'} min={1} style={{ width: '45px' }} />
          )}
        />
      </div>

      {supportsLineHops && (
        <>
          <div className={'cmp-labeled-table__label util-a-top-center'}>Line hops:</div>
          <div className={'cmp-labeled-table__value util-vcenter'}>
            <div className={'util-vstack'} style={{ width: '100%' }}>
              <PropertyEditor
                property={lineHopsType as Property<string>}
                render={props => (
                  <Select.Root {...props}>
                    <Select.Item value={'none'}>None</Select.Item>
                    <Select.Item value={'below-hide'}>Gap when below</Select.Item>
                    <Select.Item value={'below-line'}>Gap with line when below</Select.Item>
                    <Select.Item value={'below-arc'}>Arc when below</Select.Item>
                    <Select.Item value={'above-arc'}>Arc when above</Select.Item>
                  </Select.Root>
                )}
              />

              <PropertyEditor
                property={lineHopsSize}
                render={props => (
                  <NumberInput {...props} defaultUnit={'px'} min={0} style={{ width: '50px' }} />
                )}
              />
            </div>
          </div>
        </>
      )}

      <div className={'cmp-labeled-table__label'}>Line cap:</div>
      <div className={'cmp-labeled-table__value util-hstack'}>
        <PropertyEditor
          property={lineCap as Property<string>}
          render={props => (
            <Select.Root {...props}>
              <Select.Item value={'butt'}>Butt</Select.Item>
              <Select.Item value={'round'}>Round</Select.Item>
              <Select.Item value={'square'}>Square</Select.Item>
            </Select.Root>
          )}
        />
      </div>

      <div className={'cmp-labeled-table__label'}>Line join:</div>
      <div className={'cmp-labeled-table__value util-hstack'}>
        <PropertyEditor
          property={lineJoin as Property<string>}
          render={props => (
            <Select.Root {...props}>
              <Select.Item value={'miter'}>Miter</Select.Item>
              <Select.Item value={'round'}>Round</Select.Item>
              <Select.Item value={'bevel'}>Bevel</Select.Item>
            </Select.Root>
          )}
        />

        {lineJoin.val === 'miter' && (
          <PropertyEditor
            property={miterLimit}
            formatValue={v => v * 10}
            storeValue={v => v / 10}
            render={props => <NumberInput {...props} min={0} style={{ width: '50px' }} />}
          />
        )}
      </div>
    </div>
  );
};

export const EdgeLinePanel = (props: Props) => {
  const $d = useDiagram();
  const $cfg = useConfiguration();

  const strokeColor = useEdgeProperty($d, 'stroke.color');
  const fillColor = useEdgeProperty($d, 'fill.color');
  const pattern = useEdgeProperty($d, 'stroke.pattern');

  const strokeSize = useEdgeProperty($d, 'stroke.patternSize');
  const strokeSpacing = useEdgeProperty($d, 'stroke.patternSpacing');
  const strokeWidth = useEdgeProperty($d, 'stroke.width');

  const type = useEdgeProperty($d, 'type', 'straight');

  const startType = useEdgeProperty($d, 'arrow.start.type');
  const startSize = useEdgeProperty($d, 'arrow.start.size');
  const endType = useEdgeProperty($d, 'arrow.end.type');
  const endSize = useEdgeProperty($d, 'arrow.end.size');

  const lineHopsSize = useEdgeProperty($d, 'lineHops.size');
  const lineHopsType = useEdgeProperty($d, 'lineHops.type');

  const lineCap = useEdgeProperty($d, 'stroke.lineCap');
  const lineJoin = useEdgeProperty($d, 'stroke.lineJoin');
  const miterLimit = useEdgeProperty($d, 'stroke.miterLimit');

  const supportsArrows =
    !$d.selection.isEdgesOnly() ||
    $d.selection.edges.some(e => e.getDefinition().hasFlag(EdgeFlags.StyleArrows));

  const supportsLineHops =
    !$d.selection.isEdgesOnly() ||
    $d.selection.edges.some(e => e.getDefinition().hasFlag(EdgeFlags.StyleLineHops));

  const supportsFill =
    !$d.selection.isEdgesOnly() ||
    $d.selection.edges.every(e => e.getDefinition().hasFlag(EdgeFlags.StyleFill));

  return (
    <ToolWindowPanel mode={props.mode ?? 'accordion'} id="line" title={'Line'} hasCheckbox={false}>
      <EdgeLinePanelForm
        type={type}
        supportsArrows={supportsArrows}
        supportsLineHops={supportsLineHops}
        supportsFill={supportsFill}
        config={$cfg}
        diagram={$d}
        startType={startType}
        startSize={startSize}
        endType={endType}
        endSize={endSize}
        strokeSize={strokeSize}
        strokeWidth={strokeWidth}
        strokeColor={strokeColor}
        strokeSpacing={strokeSpacing}
        pattern={pattern}
        lineCap={lineCap}
        lineJoin={lineJoin}
        miterLimit={miterLimit}
        lineHopsSize={lineHopsSize}
        lineHopsType={lineHopsType}
        fillColor={fillColor}
      />
    </ToolWindowPanel>
  );
};

type Props = {
  mode?: 'accordion' | 'panel';
};
