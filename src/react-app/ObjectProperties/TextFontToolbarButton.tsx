import { useConfiguration } from '../context/ConfigurationContext.tsx';
import { useNodeDefaults } from '../useDefaults.tsx';
import { useNodeProperty } from './useProperty.ts';
import { useDiagram } from '../context/DiagramContext.tsx';
import { Select } from '../components/Select.tsx';

export const TextFontToolbarButton = (_props: Props) => {
  const { fonts } = useConfiguration();

  const $d = useDiagram();
  const defaults = useNodeDefaults();
  const font = useNodeProperty($d, 'text.font', defaults.text.font);

  return (
    <Select
      value={font.val}
      onValueChange={font.set}
      values={Object.entries(fonts).map(([label, value]) => ({ label, value }))}
    />
  );
};

interface Props {
  value?: string;
  //  onValueChange: (value: string | undefined) => void;
}
