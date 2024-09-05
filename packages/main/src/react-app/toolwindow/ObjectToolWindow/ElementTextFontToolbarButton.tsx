import { useConfiguration } from '../../context/ConfigurationContext';
import { useNodeProperty } from '../../hooks/useProperty';
import { useDiagram } from '../../context/DiagramContext';
import { Select } from '@diagram-craft/app-components/Select';

export const ElementTextFontToolbarButton = (_props: Props) => {
  const { fonts } = useConfiguration();

  const $d = useDiagram();
  const font = useNodeProperty($d, 'text.font');

  return (
    <Select.Root value={font.val} onChange={font.set}>
      {Object.entries(fonts).map(([label, value]) => (
        <Select.Item key={value} value={value}>
          {label}
        </Select.Item>
      ))}
    </Select.Root>
  );
};

interface Props {
  value?: string;
  //  onValueChange: (value: string | undefined) => void;
}
