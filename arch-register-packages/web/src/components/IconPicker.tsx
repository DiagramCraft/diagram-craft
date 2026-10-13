import { APP_ICON_NAMES, resolveAppIcon } from '../shell/appIcons';

type Props = {
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  /** When set, shows a first option that clears the selection (e.g. "use the default icon"). */
  noneLabel?: string;
};

export const IconPicker = ({ value, onChange, noneLabel }: Props) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
    {noneLabel !== undefined && (
      <button
        type="button"
        aria-pressed={value === undefined}
        onClick={() => onChange(undefined)}
        style={{
          padding: '6px 8px',
          borderRadius: 6,
          fontSize: 12,
          color: 'inherit',
          border: `1px solid ${value === undefined ? 'var(--accent, currentColor)' : 'transparent'}`,
          background: 'transparent',
          cursor: 'pointer'
        }}
      >
        {noneLabel}
      </button>
    )}
    {APP_ICON_NAMES.map(candidate => {
      const Icon = resolveAppIcon(candidate);
      const label = candidate.replace(/^Tb/, '');
      return (
        <button
          key={candidate}
          type="button"
          aria-pressed={value === candidate}
          aria-label={label}
          title={label}
          onClick={() => onChange(candidate)}
          style={{
            padding: 6,
            borderRadius: 6,
            color: 'inherit',
            border: `1px solid ${value === candidate ? 'var(--accent, currentColor)' : 'transparent'}`,
            background: 'transparent',
            cursor: 'pointer'
          }}
        >
          <Icon size={16} />
        </button>
      );
    })}
  </div>
);
