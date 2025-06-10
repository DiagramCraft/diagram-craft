export const parseNum = (str: string | undefined | null, def = 0) => {
  if (str === null) return def;
  const n = Number(str);
  return isNaN(n) ? def : n;
};

export type NumericalString = `${number}`;

export const numberToString = (n: number): NumericalString => {
  return n.toString() as NumericalString;
};
