export const parseNum = (str: string | undefined | null, def = 0) => {
  const n = Number(str);
  return isNaN(n) ? def : n;
};
