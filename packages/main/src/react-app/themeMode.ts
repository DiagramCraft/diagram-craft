import type { EffectiveTheme } from '../UserState';

export const themeModeClassName = (theme: EffectiveTheme) =>
  theme === 'dark' ? 'dark-theme' : 'light-theme';

export const applyThemeMode = (theme: EffectiveTheme) => {
  const addClassName = themeModeClassName(theme);
  const removeClassName = themeModeClassName(theme === 'dark' ? 'light' : 'dark');

  // Update class names for backward compatibility
  document.querySelectorAll(`.${removeClassName}:not(.canvas)`).forEach(element => {
    if (theme === 'dark' && element.id === 'middle') return;
    element.classList.remove(removeClassName);
    element.classList.add(addClassName);
  });

  document.body.classList.remove(removeClassName);
  document.body.classList.add(addClassName);

  // Set data-theme attribute on app root
  const appRoot = document.getElementById('app');
  if (appRoot) {
    appRoot.setAttribute('data-theme', theme);
  }

};
