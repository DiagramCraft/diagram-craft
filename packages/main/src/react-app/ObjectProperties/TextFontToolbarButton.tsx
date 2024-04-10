import { useConfiguration } from '../context/ConfigurationContext';
import { useNodeDefaults } from '../useDefaults';
import { useNodeProperty } from './useProperty';
import { useDiagram } from '../context/DiagramContext';
import { Select } from '../components/Select';

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
