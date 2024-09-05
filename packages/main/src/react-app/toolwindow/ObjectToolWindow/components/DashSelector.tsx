import { DASH_PATTERNS } from '@diagram-craft/canvas/dashPatterns';
import { Select } from '@diagram-craft/app-components/Select';
import { Property } from '../types';
import { PropertyEditor } from '../../../components/PropertyEditor';

const DashPatternPreview = (props: { type: string; pattern?: string; width?: number }) => (
  <svg width={props.width ?? 30} height={10}>
    <path
      d={`M 0 5 L ${props.width ?? 30} 5`}
      strokeWidth={'1'}
      strokeDasharray={props.pattern ?? undefined}
      style={{ fill: 'none' }}
    />
  </svg>
);

export const DashSelector = (props: Props) => {
  return (
    <PropertyEditor
      property={props.property}
      render={props => (
        <Select.Root {...props}>
          {Object.keys(DASH_PATTERNS).map(type => {
            const pattern = DASH_PATTERNS[type];
            return (
              <Select.Item key={type} value={type}>
                <DashPatternPreview type={type} pattern={pattern?.(0.5, 0.5)} width={30} />
              </Select.Item>
            );
          })}
        </Select.Root>
      )}
    />
  );
};

interface Props {
  property: Property<string>;
}
