import { DASH_PATTERNS } from '@diagram-craft/canvas/dashPatterns';
import { Select } from '@diagram-craft/app-components/Select';
import { PropertyEditor } from '../../../components/PropertyEditor';
import type { Property } from '@diagram-craft/model/property';

const DashPatternPreview = (props: {
  type: string;
  pattern?: string;
  width?: number;
  color?: string;
}) => (
  <svg width={props.width ?? 30} height={10}>
    <path
      d={`M 0 5 L ${props.width ?? 30} 5`}
      strokeWidth={'1'}
      strokeDasharray={props.pattern ?? undefined}
      stroke={props.color ?? 'unset'}
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
      renderValue={props => {
        const type = props.value;
        const pattern = DASH_PATTERNS[type];
        return (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              background: 'var(--cmp-bg)',
              padding: '5px 10px',
              borderRadius: '2px'
            }}
          >
            <DashPatternPreview
              type={type}
              pattern={pattern?.(0.5, 0.5)}
              width={30}
              color={'var(--cmp-fg)'}
            />
          </div>
        );
      }}
    />
  );
};

interface Props {
  property: Property<string>;
}
