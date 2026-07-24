import { Chip } from '../../../../../components/Chip';

export const Label = ({ text, color }: { text: string; color: string }) => {
  if (!text) return null;
  return (
    <Chip dot={color ?? undefined} tone="ghost">
      {text}
    </Chip>
  );
};
