export const $c = (base: string, modifiers: Record<string, boolean>) => {
  const classes = Object.entries(modifiers)
    .filter(([_, value]) => value)
    .map(([key, _]) => `${base}--${key}`);
  return [base, ...classes].join(' ');
};
