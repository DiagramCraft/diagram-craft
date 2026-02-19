import { useState, useCallback } from 'react';
import { TbPlus, TbTrash } from 'react-icons/tb';
import { StylesheetType } from '@diagram-craft/model/diagramStyles';
import { Button } from '@diagram-craft/app-components/Button';

type Props = {
  type: StylesheetType;
  fillColors: string[];
  strokeColors: string[];
  onFillColorsChange: (colors: string[]) => void;
  onStrokeColorsChange: (colors: string[]) => void;
};

const ColorSwatch = (props: {
  color: string;
  onChange: (color: string) => void;
  onRemove: () => void;
}) => {
  const [localColor, setLocalColor] = useState(props.color);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
      <div
        style={{
          position: 'relative',
          width: '24px',
          height: '24px',
          backgroundColor: localColor,
          border: '1px solid var(--cmp-border)',
          borderRadius: 'var(--cmp-radius)',
          overflow: 'hidden'
        }}
      >
        <input
          type="color"
          value={localColor}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            opacity: 0,
            cursor: 'pointer'
          }}
          onChange={e => {
            setLocalColor(e.target.value);
            props.onChange(e.target.value);
          }}
        />
      </div>
      <input
        type="text"
        value={localColor}
        style={{
          width: '80px',
          padding: '0.125rem 0.25rem',
          fontSize: '0.75rem',
          border: '1px solid var(--cmp-border)',
          borderRadius: 'var(--cmp-radius)',
          background: 'var(--cmp-bg)'
        }}
        onChange={e => {
          setLocalColor(e.target.value);
          props.onChange(e.target.value);
        }}
      />
      <button
        type="button"
        onClick={props.onRemove}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '20px',
          height: '20px',
          padding: 0,
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          color: 'var(--cmp-fg)'
        }}
        title="Remove color"
      >
        <TbTrash size={14} />
      </button>
    </div>
  );
};

const ColorPaletteSection = (props: {
  title: string;
  colors: string[];
  onColorsChange: (colors: string[]) => void;
}) => {
  const handleColorChange = useCallback(
    (index: number, color: string) => {
      const newColors = [...props.colors];
      newColors[index] = color;
      props.onColorsChange(newColors);
    },
    [props]
  );

  const handleRemove = useCallback(
    (index: number) => {
      const newColors = props.colors.filter((_, i) => i !== index);
      props.onColorsChange(newColors);
    },
    [props]
  );

  const handleAdd = useCallback(() => {
    props.onColorsChange([...props.colors, '#808080']);
  }, [props]);

  return (
    <div style={{ flex: 1 }}>
      <div
        style={{
          fontWeight: 500,
          marginBottom: '0.5rem',
          fontSize: '0.875rem',
          color: 'var(--cmp-fg)'
        }}
      >
        {props.title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        {props.colors.map((color, index) => (
          <ColorSwatch
            key={index}
            color={color}
            onChange={c => handleColorChange(index, c)}
            onRemove={() => handleRemove(index)}
          />
        ))}
        <Button type="secondary" onClick={handleAdd} style={{ marginTop: '0.25rem' }}>
          <TbPlus size={14} />
          Add Color
        </Button>
      </div>
    </div>
  );
};

export const StylesheetPaletteEditor = (props: Props) => {
  const showFillColors = props.type === 'node';

  return (
    <div style={{ padding: '0.5rem 0', display: 'flex', gap: '1.5rem' }}>
      {showFillColors && (
        <ColorPaletteSection
          title="Fill Colors"
          colors={props.fillColors}
          onColorsChange={props.onFillColorsChange}
        />
      )}
      <ColorPaletteSection
        title="Stroke Colors"
        colors={props.strokeColors}
        onColorsChange={props.onStrokeColorsChange}
      />
    </div>
  );
};
