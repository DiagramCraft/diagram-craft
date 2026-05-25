import { STATUS_TONE } from '../data';
import { Chip } from './Chip';

type StatusChipProps = {
  value: string;
};

export const StatusChip = ({ value }: StatusChipProps) => {
  const t = STATUS_TONE[value] ?? STATUS_TONE['Active']!;
  return (
    <Chip dot={t!.dot} tone="ghost">
      {value}
    </Chip>
  );
};
