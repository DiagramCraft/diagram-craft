import * as Select from '@radix-ui/react-select';
import { TbCheck, TbChevronDown } from 'react-icons/tb';
import { useConfiguration } from '../context/ConfigurationContext.tsx';
import { useNodeDefaults } from '../useDefaults.tsx';
import { useNodeProperty } from './useProperty.ts';
import { useDiagram } from '../context/DiagramContext.tsx';

export const TextFontToolbarButton = (_props: Props) => {
  const { fonts } = useConfiguration();

  const $d = useDiagram();
  const defaults = useNodeDefaults();
  const font = useNodeProperty($d, 'text.font', defaults.text.font);

  return (
    <Select.Root value={font.val} onValueChange={font.set}>
      <Select.Trigger className="cmp-select-trigger">
        <Select.Value placeholder={font.val} />
        <Select.Icon className="cmp-select-trigger__icon">
          <TbChevronDown />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className="cmp-select-content">
          <Select.Viewport className="cmp-select-content__viewpoint">
            <Select.Group>
              {Object.entries(fonts).map(([label, value]) => {
                return (
                  <Select.Item key={value} className={'cmp-select-content__item'} value={value}>
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
