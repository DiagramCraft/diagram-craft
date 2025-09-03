export const convertKeybindingToAccelerator = (keybinding: string) => {
  return keybinding
    .replace('M-', 'CommandOrControl+')
    .replace('A-', 'Alt+')
    .replace('S-', 'Shift+')
    .replace('C-', 'Control+')
    .replace('Key', '');
};
