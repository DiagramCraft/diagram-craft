import type { ReactNode } from 'react';

export const MultiValueEditor = ({
  value,
  onChange,
  createValue,
  renderItem,
  addLabel = 'Add value'
}: {
  value: unknown;
  onChange: (value: unknown[]) => void;
  createValue: () => unknown;
  renderItem: (value: unknown, index: number, update: (value: unknown) => void) => ReactNode;
  addLabel?: string;
}) => {
  const values = Array.isArray(value) ? value : value == null || value === '' ? [] : [value];

  const updateAt = (index: number, next: unknown) =>
    onChange(values.map((item, itemIndex) => (itemIndex === index ? next : item)));
  const removeAt = (index: number) => onChange(values.filter((_, itemIndex) => itemIndex !== index));
  const move = (index: number, offset: -1 | 1) => {
    const nextIndex = index + offset;
    if (nextIndex < 0 || nextIndex >= values.length) return;
    const next = [...values];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    onChange(next);
  };

  return (
    <div style={{ display: 'grid', gap: 6, width: '100%' }}>
      {values.map((item, index) => (
        <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ flex: 1 }}>
            {renderItem(item, index, next => updateAt(index, next))}
          </div>
          <button type="button" disabled={index === 0} onClick={() => move(index, -1)}>
            ↑
          </button>
          <button
            type="button"
            disabled={index === values.length - 1}
            onClick={() => move(index, 1)}
          >
            ↓
          </button>
          <button type="button" onClick={() => removeAt(index)} aria-label="Remove value">
            ×
          </button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...values, createValue()])}>
        {addLabel}
      </button>
    </div>
  );
};
