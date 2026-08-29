import { Select } from '@diagram-craft/app-components/Select';
import type { Category } from '@arch-register/api-types/categoryContract';

const NONE = '__none__';

export const CategorySelect = ({
  value,
  categories,
  disabled,
  onChange
}: {
  value: string | null;
  categories: Category[];
  disabled?: boolean;
  onChange: (categoryId: string | null) => void;
}) => (
  <Select.Root
    value={value ?? NONE}
    disabled={disabled}
    onChange={next => onChange(!next || next === NONE ? null : next)}
    style={{ width: '100%' }}
  >
    <Select.Item value={NONE}>None</Select.Item>
    {categories.map(category => (
      <Select.Item key={category.id} value={category.id}>
        {category.name}
      </Select.Item>
    ))}
  </Select.Root>
);
