import { useConfiguration } from '../../context/ConfigurationContext';
import { useNodeDefaults } from '../../hooks/useDefaults';
import { useNodeProperty } from '../../hooks/useProperty';
import { useDiagram } from '../../context/DiagramContext';
import { Select } from '../../components/Select';

export const ElementTextFontToolbarButton = (_props: Props) => {
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
