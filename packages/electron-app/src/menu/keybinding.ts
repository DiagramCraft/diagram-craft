const KEY_CODE_MAP: Record<string, string> = {
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  Equal: '=',
  Minus: '-',
  Slash: '/',
  BracketLeft: '[',
  BracketRight: ']'
};

const normalizeKeyCode = (keyCode: string) => {
  if (keyCode.startsWith('Key')) return keyCode.slice(3);
  if (keyCode.startsWith('Digit')) return keyCode.slice(5);
  return KEY_CODE_MAP[keyCode] ?? keyCode;
};

export const convertKeybindingToAccelerator = (keybinding: string) => {
  if (keybinding === '') return '';

  const parts = keybinding.split('-');
  const keyCode = parts.pop() ?? '';

  const modifiers = parts.map(part => {
    switch (part) {
      case 'M':
        return 'CommandOrControl';
      case 'A':
        return 'Alt';
      case 'S':
        return 'Shift';
      case 'C':
        return 'Control';
      default:
        return part;
    }
  });

  return [...modifiers, normalizeKeyCode(keyCode)].join('+');
};
