import type { ThemeMode } from '../UserState';

export const themeModeClassName = (themeMode: ThemeMode) =>
  themeMode === 'dark' ? 'dark-theme' : 'light-theme';

export const applyThemeMode = (themeMode: ThemeMode) => {
  const addClassName = themeModeClassName(themeMode);
  const removeClassName = themeModeClassName(themeMode === 'dark' ? 'light' : 'dark');

  document.querySelectorAll(`.${removeClassName}:not(.canvas)`).forEach(element => {
    if (themeMode === 'dark' && element.id === 'middle') return;
    element.classList.remove(removeClassName);
    element.classList.add(addClassName);
  });

  document.body.classList.remove(removeClassName);
  document.body.classList.add(addClassName);
};
