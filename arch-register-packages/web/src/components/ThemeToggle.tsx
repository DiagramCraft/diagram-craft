import { TbMoon, TbSun } from 'react-icons/tb';
import type { Theme } from '../hooks/useTheme';
import styles from './ThemeToggle.module.css';

export const ThemeToggle = ({
  theme,
  onSetTheme
}: {
  theme: Theme;
  onSetTheme: (theme: Theme) => void;
}) => {
  const options = [
    { value: 'light' as const, label: 'Light', icon: <TbSun size={13} /> },
    { value: 'dark' as const, label: 'Dark', icon: <TbMoon size={13} /> }
  ];

  return (
    <fieldset className={styles.themeToggle}>
      <legend className={styles.visuallyHidden}>Theme</legend>
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          aria-pressed={theme === option.value}
          className={`${styles.themeOpt} ${theme === option.value ? styles.themeOptActive : ''}`}
          onMouseDown={event => event.stopPropagation()}
          onClick={() => onSetTheme(option.value)}
        >
          {option.icon}
          <span>{option.label}</span>
        </button>
      ))}
    </fieldset>
  );
};
