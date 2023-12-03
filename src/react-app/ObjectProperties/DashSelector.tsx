import * as Select from '@radix-ui/react-select';
import { TbCheck, TbChevronDown } from 'react-icons/tb';
import { DASH_PATTERNS, DashPattern } from '../../base-ui/dashPatterns.ts';

const DashPatternPreview = (props: { type: string; pattern?: DashPattern }) => (
  <svg width={50} height={10}>
    <path
      d={`M 0 5 L 50 5`}
      stroke={'var(--secondary-fg)'}
      strokeWidth={'1'}
      strokeDasharray={props.pattern?.pattern ?? undefined}
      style={{ fill: 'none' }}
    />
  </svg>
);

export const DashSelector = (props: Props) => {
  return (
    <Select.Root value={props.value} onValueChange={props.onValueChange}>
      <Select.Trigger className="cmp-select-trigger">
        <Select.Value
          placeholder={
            <DashPatternPreview
              type={props.value ?? 'SOLID'}
              pattern={DASH_PATTERNS[props.value ?? 'SOLID']}
            />
          }
        />
        <Select.Icon className="cmp-select-trigger__icon">
          <TbChevronDown />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className="cmp-select-content">
          <Select.Viewport className="cmp-select-content__viewpoint">
            <Select.Group>
              {Object.keys(DASH_PATTERNS).map(type => {
                const pattern = DASH_PATTERNS[type];
                return (
                  <Select.Item key={type} className={'cmp-select-content__item'} value={type}>
                    <Select.ItemText>
                      <DashPatternPreview type={type} pattern={pattern} />
                    </Select.ItemText>
                    <Select.ItemIndicator className="cmp-select-content__item-indicator">
                      <TbCheck />
                    </Select.ItemIndicator>
                  </Select.Item>
                );
              })}
            </Select.Group>
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
};

interface Props {
  value?: string;
  onValueChange: (value: string | undefined) => void;
}
