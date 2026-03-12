import { ToolWindowPanel } from '../ToolWindowPanel';
import { useNodeProperty } from '../../hooks/useProperty';
import { Checkbox } from '@diagram-craft/app-components/Checkbox';
import { PropertyEditor } from '../../components/PropertyEditor';
import { useDiagram } from '../../../application';
import { NumberInput } from '@diagram-craft/app-components/NumberInput';
import type { Property } from '@diagram-craft/model/property';
import { KeyValueTable } from '@diagram-craft/app-components/KeyValueTable';

type FormProps = {
  resizableH: Property<boolean>;
  resizableV: Property<boolean>;
  movable: Property<boolean>;
  editable: Property<boolean>;
  deletable: Property<boolean>;
  rotatable: Property<boolean>;
  inheritStyle: Property<boolean>;
  routingSpacing: Property<number>;
  adjustSizeBasedOnText: Property<boolean>;
};

export const NodeAdvancedPropertiesPanelForm = ({
  resizableH,
  resizableV,
  movable,
  editable,
  deletable,
  rotatable,
  inheritStyle,
  routingSpacing,
  adjustSizeBasedOnText
}: FormProps) => {
  return (
    <KeyValueTable.Root type="wide">
      <KeyValueTable.Label>Resize Horizontally:</KeyValueTable.Label>
      <KeyValueTable.Value>
        <PropertyEditor property={resizableH} render={props => <Checkbox {...props} />} />
      </KeyValueTable.Value>

      <KeyValueTable.Label>Resize Vertically:</KeyValueTable.Label>
      <KeyValueTable.Value>
        <PropertyEditor property={resizableV} render={props => <Checkbox {...props} />} />
      </KeyValueTable.Value>

      <KeyValueTable.Label>Resize Based On Text:</KeyValueTable.Label>
      <KeyValueTable.Value>
        <PropertyEditor
          property={adjustSizeBasedOnText}
          render={props => <Checkbox {...props} />}
        />
      </KeyValueTable.Value>

      <KeyValueTable.Label>Movable:</KeyValueTable.Label>
      <KeyValueTable.Value>
        <PropertyEditor property={movable} render={props => <Checkbox {...props} />} />
      </KeyValueTable.Value>

      <KeyValueTable.Label>Rotatable:</KeyValueTable.Label>
      <KeyValueTable.Value>
        <PropertyEditor property={rotatable} render={props => <Checkbox {...props} />} />
      </KeyValueTable.Value>

      <KeyValueTable.Label>Editable:</KeyValueTable.Label>
      <KeyValueTable.Value>
        <PropertyEditor property={editable} render={props => <Checkbox {...props} />} />
      </KeyValueTable.Value>

      <KeyValueTable.Label>Deletable:</KeyValueTable.Label>
      <KeyValueTable.Value>
        <PropertyEditor property={deletable} render={props => <Checkbox {...props} />} />
      </KeyValueTable.Value>

      <KeyValueTable.Label>Inherit Style:</KeyValueTable.Label>
      <KeyValueTable.Value>
        <PropertyEditor property={inheritStyle} render={props => <Checkbox {...props} />} />
      </KeyValueTable.Value>

      <KeyValueTable.Label>Anchor Spacing:</KeyValueTable.Label>
      <KeyValueTable.Value>
        <PropertyEditor
          property={routingSpacing}
          render={props => <NumberInput {...props} defaultUnit={'px'} />}
        />
      </KeyValueTable.Value>
    </KeyValueTable.Root>
  );
};

export const NodeAdvancedPropertiesPanel = (props: Props) => {
  const diagram = useDiagram();
  const resizableH = useNodeProperty(diagram, 'capabilities.resizable.horizontal');
  const resizableV = useNodeProperty(diagram, 'capabilities.resizable.vertical');
  const movable = useNodeProperty(diagram, 'capabilities.movable');
  const editable = useNodeProperty(diagram, 'capabilities.editable');
  const deletable = useNodeProperty(diagram, 'capabilities.deletable');
  const rotatable = useNodeProperty(diagram, 'capabilities.rotatable');
  const inheritStyle = useNodeProperty(diagram, 'capabilities.inheritStyle');
  const routingSpacing = useNodeProperty(diagram, 'routing.spacing');
  const adjustSizeBasedOnText = useNodeProperty(diagram, 'capabilities.adjustSizeBasedOnText');

  return (
    <ToolWindowPanel
      mode={props.mode ?? 'accordion'}
      id="advanced-props"
      title={'Advanced Properties'}
      hasCheckbox={false}
    >
      <NodeAdvancedPropertiesPanelForm
        resizableH={resizableH}
        resizableV={resizableV}
        movable={movable}
        editable={editable}
        deletable={deletable}
        rotatable={rotatable}
        inheritStyle={inheritStyle}
        routingSpacing={routingSpacing}
        adjustSizeBasedOnText={adjustSizeBasedOnText}
      />
    </ToolWindowPanel>
  );
};

type Props = {
  mode?: 'accordion' | 'panel';
};
