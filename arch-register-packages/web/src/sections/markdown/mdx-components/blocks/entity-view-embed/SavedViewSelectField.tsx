import { Select } from '@diagram-craft/app-components/Select';
import { EmptyState } from '../../../../../components/EmptyState';

type Props = {
  adminViews: { id: string; name: string }[];
  value: string;
  onChange: (viewId: string) => void;
};

export const SavedViewSelectField = ({ adminViews, value, onChange }: Props) =>
  adminViews.length === 0 ? (
    <EmptyState
      compact
      title="No saved views available. Create an admin view in the entity browser first."
    />
  ) : (
    <Select.Root value={value} onChange={v => onChange(v ?? '')}>
      {adminViews.map(view => (
        <Select.Item key={view.id} value={view.id}>
          {view.name}
        </Select.Item>
      ))}
    </Select.Root>
  );
