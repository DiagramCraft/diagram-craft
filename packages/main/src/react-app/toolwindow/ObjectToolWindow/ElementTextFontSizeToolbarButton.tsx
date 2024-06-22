import { useNodeDefaults } from '../../hooks/useDefaults';
import { useNodeProperty } from '../../hooks/useProperty';
import { useDiagram } from '../../context/DiagramContext';
import { Select } from '../../components/Select';

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

export const ElementTextFontSizeToolbarButton = (_props: Props) => {
  const $d = useDiagram();
  const defaults = useNodeDefaults();
  const fontSize = useNodeProperty($d, 'text.fontSize', defaults.text.fontSize);

  return (
    <Select
      value={fontSize.val.toString()}
      onValueChange={a => fontSize.set(Number(a))}
      values={Object.entries(SIZES).map(([k, v]) => ({ label: k, value: v.toString() }))}
    />
  );
};

interface Props {
  value?: string;
  //  onValueChange: (value: string | undefined) => void;
}
