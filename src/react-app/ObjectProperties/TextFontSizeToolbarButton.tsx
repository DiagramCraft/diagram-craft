import * as Select from '@radix-ui/react-select';
import { TbCheck, TbChevronDown } from 'react-icons/tb';
import { useNodeDefaults } from '../useDefaults.tsx';
import { useNodeProperty } from './useProperty.ts';
import { useDiagram } from '../context/DiagramContext.tsx';

const SIZES = {
  '10px': 10,
  '12px': 12,
  '14px': 14,
  '16px': 16,
  '18px': 18,
  '20px': 20,
  '24px': 24,
  '30px': 30,
  '36px': 36,
  '48px': 48,
  '64px': 64,
  '72px': 72,
  '96px': 96
};

export const TextFontSizeToolbarButton = (_props: Props) => {
  const $d = useDiagram();
  const defaults = useNodeDefaults();
  const fontSize = useNodeProperty($d, 'text.fontSize', defaults.text.fontSize);

  return (
    <Select.Root value={fontSize.val.toString()} onValueChange={a => fontSize.set(Number(a))}>
      <Select.Trigger className="cmp-select-trigger">
        <Select.Value placeholder={fontSize.val} />
        <Select.Icon className="cmp-select-trigger__icon">
          <TbChevronDown />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className="cmp-select-content">
          <Select.Viewport className="cmp-select-content__viewpoint">
            <Select.Group>
              {Object.entries(SIZES).map(([label, value]) => {
                return (
                  <Select.Item
                    key={value}
                    className={'cmp-select-content__item'}
                    value={value.toString()}
                  >
                    <Select.ItemText>{label}</Select.ItemText>
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
  //  onValueChange: (value: string | undefined) => void;
}
