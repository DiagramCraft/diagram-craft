export type EnumOptionLike = {
  value: string;
  retired?: boolean;
};

export const selectableEnumOptions = <T extends EnumOptionLike>(
  options: readonly T[],
  currentValue: unknown
): T[] => {
  const currentValues = new Set(
    (Array.isArray(currentValue) ? currentValue : [currentValue]).filter(
      (value): value is string => typeof value === 'string'
    )
  );
  return options.filter(option => option.retired !== true || currentValues.has(option.value));
};
